"""
Hybrid monotonic poem-audio alignment ("محاذاة شعرية هجينة رتيبة").

Instead of greedy verse-by-verse matching (where one bad verse shifts the rest
of the poem), all poem tokens are aligned against all ASR words at once with a
semi-global dynamic program:

- Leading/trailing transcript words (reciter intro/outro) are free to skip.
- Extra or missing ASR words cost a small penalty but never break monotonicity.
- Token match scores blend orthographic and phonetic Arabic similarity and are
  weighted by ASR word probability.
- Verse boundaries come from real matched-word anchors; confidence reflects
  match quality + coverage (no artificial 0.5 floor).
- Verses that could not be anchored are interpolated and flagged status="review".
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
from difflib import SequenceMatcher
from .normalizer import normalize_arabic, tokenize_normalized, phonetic_key
from ..schemas.transcript import TimedWord
from ..audio.vad import AudioRegion
from .silence_aligner import refine_boundaries_with_silence, VerseSyncDiagnostic

# Minimum similarity for a DP-matched pair to count as a reliable time anchor
ANCHOR_MIN_SIMILARITY = 0.55
# DP penalties (score is maximized)
GAP_TRANSCRIPT_PENALTY = 0.18   # extra/unmatched ASR word inside the poem body
GAP_VERSE_PENALTY = 0.28        # poem word missing from the transcript
MIN_MATCH_SCORE = 0.35          # below this a "match" is worse than two gaps

@dataclass
class VerseAlignmentResult:
    verse_id: str
    order_index: int
    start_ms: int
    end_ms: int
    confidence: float
    status: str = "auto"
    first_hemistich_end_ms: Optional[int] = None
    second_hemistich_start_ms: Optional[int] = None
    matched_words_count: int = 0
    total_words_count: int = 0
    first_word_start_ms: Optional[int] = None
    last_word_end_ms: Optional[int] = None
    diagnostic: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {
            "verse_id": self.verse_id,
            "order_index": self.order_index,
            "start_ms": self.start_ms,
            "end_ms": self.end_ms,
            "confidence": round(self.confidence, 3),
            "status": self.status,
            "matched_words_count": self.matched_words_count,
            "total_words_count": self.total_words_count,
        }
        if self.first_hemistich_end_ms is not None:
            d["first_hemistich_end_ms"] = self.first_hemistich_end_ms
        if self.second_hemistich_start_ms is not None:
            d["second_hemistich_start_ms"] = self.second_hemistich_start_ms
        if self.first_word_start_ms is not None:
            d["first_word_start_ms"] = self.first_word_start_ms
        if self.last_word_end_ms is not None:
            d["last_word_end_ms"] = self.last_word_end_ms
        if self.diagnostic is not None:
            d["diagnostic"] = self.diagnostic
        return d

@dataclass
class PoemAlignmentResult:
    poem_id: str
    recording_id: str
    overall_confidence: float
    alignments: List[VerseAlignmentResult] = field(default_factory=list)
    intro_offset_ms: int = 0
    diagnostics: List[VerseSyncDiagnostic] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "poem_id": self.poem_id,
            "recording_id": self.recording_id,
            "overall_confidence": round(self.overall_confidence, 3),
            "intro_offset_ms": self.intro_offset_ms,
            "alignments": [a.to_dict() for a in self.alignments],
            "diagnostics": [d.to_dict() for d in self.diagnostics],
        }

from functools import lru_cache

@lru_cache(maxsize=262144)
def token_similarity(a: str, b: str) -> float:
    """Blend of orthographic and phonetic similarity for normalized Arabic tokens.

    Cached: DP over a long poem repeats the same (poem-token, ASR-word) pairs
    many times, and the traceback re-queries pairs already scored.
    """
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    la, lb = len(a), len(b)
    # Cheap upper bound: SequenceMatcher ratio <= 2*min(la,lb)/(la+lb).
    # If even the best case is below the usable threshold, skip the expensive work.
    ub = 2.0 * min(la, lb) / (la + lb)
    if ub < MIN_MATCH_SCORE and not (la > 2 and a[0] in "وفبلك") and not (lb > 2 and b[0] in "وفبلك"):
        return 0.0
    ortho = SequenceMatcher(None, a, b).ratio()
    pa, pb = phonetic_key(a), phonetic_key(b)
    if pa and pa == pb:
        phon = 1.0
    else:
        phon = SequenceMatcher(None, pa, pb).ratio() if pa and pb else 0.0
    # Clitic tolerance: ASR often drops/adds a leading و/ف/ب/ل
    stripped = 0.0
    if len(a) > 2 and a[0] in "وفبلك" and a[1:] == b:
        stripped = 0.9
    elif len(b) > 2 and b[0] in "وفبلك" and b[1:] == a:
        stripped = 0.9
    return max(0.6 * ortho + 0.4 * phon, stripped)

def _semi_global_align(
    poem_tokens: List[str],
    transcript: List[Dict[str, Any]],
) -> List[Tuple[int, int, float]]:
    """
    Semi-global DP: every poem token position vs every transcript word.
    Leading/trailing transcript words are free (intro/outro).
    Returns monotonic matched pairs (poem_idx, transcript_idx, similarity).
    """
    n = len(poem_tokens)
    m = len(transcript)
    if n == 0 or m == 0:
        return []

    NEG = float("-inf")
    # dp[i][j]: best score aligning first i poem tokens with first j transcript words
    dp = [[NEG] * (m + 1) for _ in range(n + 1)]
    back = [[0] * (m + 1) for _ in range(n + 1)]  # 1=match, 2=skip poem, 3=skip transcript

    # Free leading transcript skip; poem tokens missing at the very start still cost
    for j in range(m + 1):
        dp[0][j] = 0.0
    for i in range(1, n + 1):
        dp[i][0] = dp[i - 1][0] - GAP_VERSE_PENALTY
        back[i][0] = 2

    for i in range(1, n + 1):
        tok = poem_tokens[i - 1]
        row = dp[i]
        prev_row = dp[i - 1]
        back_row = back[i]
        for j in range(1, m + 1):
            w = transcript[j - 1]
            sim = token_similarity(tok, w["norm"])
            # ASR probability weighting: low-confidence words earn less
            match_score = sim * (0.7 + 0.3 * w["prob"]) if sim >= MIN_MATCH_SCORE else NEG

            best = prev_row[j] - GAP_VERSE_PENALTY
            move = 2
            skip_t = row[j - 1] - GAP_TRANSCRIPT_PENALTY
            if skip_t > best:
                best = skip_t
                move = 3
            if match_score > NEG:
                mv = prev_row[j - 1] + match_score
                if mv >= best:
                    best = mv
                    move = 1
            row[j] = best
            back_row[j] = move

    # Free trailing transcript skip: end anywhere in the last row
    best_j = max(range(m + 1), key=lambda j: dp[n][j])

    pairs: List[Tuple[int, int, float]] = []
    i, j = n, best_j
    while i > 0 and j > 0:
        move = back[i][j]
        if move == 1:
            sim = token_similarity(poem_tokens[i - 1], transcript[j - 1]["norm"])
            pairs.append((i - 1, j - 1, sim))
            i -= 1
            j -= 1
        elif move == 2:
            i -= 1
        else:
            j -= 1
    pairs.reverse()
    return pairs

def _interpolated_fallback(
    verses_info: List[Dict[str, Any]],
    audio_duration_ms: int,
    poem_id: str,
    recording_id: str,
) -> PoemAlignmentResult:
    """No usable transcript: word-count-proportional slices, flagged for review.

    Strictly bounded by the real recording duration. If the duration is
    unknown (<= 0) no timing can be estimated honestly, so no alignments are
    produced — the recording is saved unaligned rather than with fabricated
    boundaries.
    """
    if audio_duration_ms <= 0:
        return PoemAlignmentResult(
            poem_id=poem_id,
            recording_id=recording_id,
            overall_confidence=0.0,
            alignments=[],
        )
    total_tokens = sum(max(1, len(v["tokens"])) for v in verses_info) or 1
    alignments: List[VerseAlignmentResult] = []
    duration = audio_duration_ms
    cursor = 0.0
    for v in verses_info:
        share = max(1, len(v["tokens"])) / total_tokens * duration
        start = int(cursor)
        end = int(cursor + share)
        cursor += share
        mid = start + (end - start) // 2
        alignments.append(
            VerseAlignmentResult(
                verse_id=v["id"],
                order_index=v["order_index"],
                start_ms=start,
                end_ms=end,
                confidence=0.2,
                status="review",
                first_hemistich_end_ms=mid,
                second_hemistich_start_ms=mid,
                matched_words_count=0,
                total_words_count=len(v["tokens"]),
                first_word_start_ms=start,
                last_word_end_ms=end,
                diagnostic={"method": "interpolated", "reason": "no_transcript"},
            )
        )
    if alignments:
        alignments[-1].end_ms = duration
    return PoemAlignmentResult(
        poem_id=poem_id,
        recording_id=recording_id,
        overall_confidence=0.2,
        alignments=alignments,
    )

def align_transcript_to_verses(
    verses: List[Dict[str, Any]],
    transcript_words: List[TimedWord],
    audio_duration_ms: int,
    poem_id: str = "poem",
    recording_id: str = "rec",
    silence_regions: Optional[List[AudioRegion]] = None,
) -> PoemAlignmentResult:
    if not verses:
        return PoemAlignmentResult(poem_id=poem_id, recording_id=recording_id, overall_confidence=0.0)

    # 1. Normalize transcript words (keep timing + ASR probability)
    norm_transcript = []
    for w in transcript_words:
        norm = normalize_arabic(w.word)
        if not norm:
            continue
        # Preserve an explicit probability of 0.0 (rejected ASR word);
        # default to 1.0 only when the field is absent.
        p = getattr(w, "probability", None)
        prob = 1.0 if p is None else max(0.0, min(1.0, float(p)))
        norm_transcript.append({
            "norm": norm,
            "start_ms": int(w.start_ms),
            "end_ms": int(w.end_ms),
            "prob": prob,
        })

    # 2. Verse token structures
    verses_info: List[Dict[str, Any]] = []
    for i, v in enumerate(verses):
        v_id = str(v.get("id", f"v-{i+1}"))
        v_text = str(v.get("text", ""))
        first_h = str(v.get("first_hemistich", v.get("firstHemistich", "")) or "")
        second_h = str(v.get("second_hemistich", v.get("secondHemistich", "")) or "")
        if not v_text and (first_h or second_h):
            v_text = f"{first_h} {second_h}".strip()
        verses_info.append({
            "id": v_id,
            "order_index": i + 1,
            "tokens": tokenize_normalized(v_text),
            "first_tokens": tokenize_normalized(first_h),
            "second_tokens": tokenize_normalized(second_h),
        })

    if not norm_transcript:
        return _interpolated_fallback(verses_info, audio_duration_ms, poem_id, recording_id)

    # 3. Flatten poem tokens with owning verse index
    poem_tokens: List[str] = []
    token_verse: List[int] = []
    verse_token_start: List[int] = []  # index in poem_tokens where each verse starts
    for v_idx, v in enumerate(verses_info):
        verse_token_start.append(len(poem_tokens))
        for t in v["tokens"]:
            poem_tokens.append(t)
            token_verse.append(v_idx)

    pairs = _semi_global_align(poem_tokens, norm_transcript)

    # 4. Collect per-verse anchors (reliable matched words only)
    n_verses = len(verses_info)
    verse_anchors: List[List[Tuple[int, int, float]]] = [[] for _ in range(n_verses)]
    for p_idx, t_idx, sim in pairs:
        if sim >= ANCHOR_MIN_SIMILARITY:
            # Weight anchor quality by ASR word probability so rejected
            # (prob=0) words cannot inflate verse confidence.
            weighted = sim * (0.7 + 0.3 * norm_transcript[t_idx]["prob"])
            verse_anchors[token_verse[p_idx]].append((p_idx, t_idx, weighted))

    intro_offset_ms = 0
    if verse_anchors and verse_anchors[0]:
        intro_offset_ms = norm_transcript[verse_anchors[0][0][1]]["start_ms"]
    elif pairs:
        intro_offset_ms = norm_transcript[pairs[0][1]]["start_ms"]

    # 5. Raw per-verse timing from anchors; interpolate unanchored verses
    raw_alignments: List[Dict[str, Any]] = []
    for v_idx, v in enumerate(verses_info):
        anchors = verse_anchors[v_idx]
        n_tokens = max(1, len(v["tokens"]))
        if anchors:
            first_t = norm_transcript[anchors[0][1]]
            last_t = norm_transcript[anchors[-1][1]]
            sims = [a[2] for a in anchors]
            coverage = min(1.0, len(anchors) / n_tokens)
            quality = sum(sims) / len(sims)
            # Continuity: anchors should be a compact transcript run, not scattered
            span = anchors[-1][1] - anchors[0][1] + 1
            continuity = min(1.0, len(anchors) / span) if span > 0 else 0.0
            confidence = max(0.0, min(1.0, quality * (0.55 * coverage + 0.30) + 0.15 * continuity))
            raw_alignments.append({
                "info": v,
                "anchored": True,
                "start_ms": first_t["start_ms"],
                "end_ms": last_t["end_ms"],
                "first_word_start_ms": first_t["start_ms"],
                "last_word_end_ms": last_t["end_ms"],
                "confidence": confidence,
                "matched_count": len(anchors),
                "anchors": anchors,
            })
        else:
            raw_alignments.append({
                "info": v,
                "anchored": False,
                "start_ms": None,
                "end_ms": None,
                "first_word_start_ms": None,
                "last_word_end_ms": None,
                "confidence": 0.0,
                "matched_count": 0,
                "anchors": [],
            })

    _fill_unanchored(raw_alignments, intro_offset_ms, audio_duration_ms)

    # 6. Hemistich split from anchors when possible
    for v_idx, r in enumerate(raw_alignments):
        h1_len = len(r["info"]["first_tokens"])
        split_ms = None
        if r["anchored"] and h1_len > 0:
            v_start_token = verse_token_start[v_idx]
            h1_last_global = v_start_token + h1_len - 1
            before = [a for a in r["anchors"] if a[0] <= h1_last_global]
            after = [a for a in r["anchors"] if a[0] > h1_last_global]
            if before and after:
                split_ms = (norm_transcript[before[-1][1]]["end_ms"] + norm_transcript[after[0][1]]["start_ms"]) // 2
        r["hemistich_split_ms"] = split_ms

    # 7. Silence-refined boundaries
    refined_raw, diagnostics = refine_boundaries_with_silence(
        raw_verse_alignments=raw_alignments,
        silence_regions=silence_regions or [],
        audio_duration_ms=audio_duration_ms,
    )

    final_alignments: List[VerseAlignmentResult] = []
    total_conf = 0.0
    for r in refined_raw:
        conf = r["confidence"]
        total_conf += conf
        final_alignments.append(
            VerseAlignmentResult(
                verse_id=r["verse_id"],
                order_index=r["order_index"],
                start_ms=r["start_ms"],
                end_ms=r["end_ms"],
                confidence=conf,
                status=r["status"],
                first_hemistich_end_ms=r["first_hemistich_end_ms"],
                second_hemistich_start_ms=r["second_hemistich_start_ms"],
                matched_words_count=r["matched_words_count"],
                total_words_count=r["total_words_count"],
                first_word_start_ms=r["first_word_start_ms"],
                last_word_end_ms=r["last_word_end_ms"],
                diagnostic=r.get("diagnostic"),
            )
        )

    overall_conf = total_conf / len(final_alignments) if final_alignments else 0.0
    return PoemAlignmentResult(
        poem_id=poem_id,
        recording_id=recording_id,
        overall_confidence=overall_conf,
        intro_offset_ms=intro_offset_ms,
        alignments=final_alignments,
        diagnostics=diagnostics,
    )

def _fill_unanchored(
    raw_alignments: List[Dict[str, Any]],
    intro_offset_ms: int,
    audio_duration_ms: int,
) -> None:
    """Interpolates timing for verses without anchors between anchored neighbors."""
    n = len(raw_alignments)
    i = 0
    while i < n:
        if raw_alignments[i]["anchored"]:
            i += 1
            continue
        # find run of unanchored [i, j)
        j = i
        while j < n and not raw_alignments[j]["anchored"]:
            j += 1
        prev_end = raw_alignments[i - 1]["end_ms"] if i > 0 else intro_offset_ms
        # Trailing unanchored run with unknown duration: no honest estimate
        # exists, so collapse to the previous end (normalization guarantees
        # minimal positive spans) instead of fabricating 8-second slots.
        next_start = raw_alignments[j]["start_ms"] if j < n else (audio_duration_ms if audio_duration_ms > 0 else prev_end)
        gap = max(0, next_start - prev_end)
        total_tokens = sum(max(1, len(raw_alignments[k]["info"]["tokens"])) for k in range(i, j)) or 1
        cursor = float(prev_end)
        for k in range(i, j):
            share = max(1, len(raw_alignments[k]["info"]["tokens"])) / total_tokens * gap
            r = raw_alignments[k]
            r["start_ms"] = int(cursor)
            r["end_ms"] = int(cursor + share)
            r["first_word_start_ms"] = r["start_ms"]
            r["last_word_end_ms"] = r["end_ms"]
            r["confidence"] = 0.2
            cursor += share
        i = j
