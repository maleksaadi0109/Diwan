from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from difflib import SequenceMatcher
from .normalizer import normalize_arabic, tokenize_normalized
from ..schemas.transcript import TimedWord
from ..audio.vad import AudioRegion
from .silence_aligner import refine_boundaries_with_silence, VerseSyncDiagnostic

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

def token_similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    return SequenceMatcher(None, a, b).ratio()

def find_first_reliable_match(
    first_verse_tokens: List[str],
    norm_transcript: List[Dict[str, Any]],
    min_confidence: float = 0.65,
) -> int:
    """
    Finds the index in norm_transcript where the poem actually begins,
    ignoring reciter intro commentary or ambient noise.
    """
    if not first_verse_tokens or not norm_transcript:
        return 0

    n_sample = min(4, len(first_verse_tokens))
    sample_tokens = first_verse_tokens[:n_sample]

    best_idx = 0
    best_score = 0.0

    search_limit = min(len(norm_transcript), 35)
    for i in range(search_limit):
        window = [norm_transcript[j]["norm"] for j in range(i, min(len(norm_transcript), i + n_sample))]
        score = SequenceMatcher(None, sample_tokens, window).ratio()
        if score > best_score:
            best_score = score
            best_idx = i
            if score >= 0.85:
                break

    if best_score >= min_confidence:
        return best_idx
    return 0

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

    # 1. Normalize transcribed words
    norm_transcript = [
        {
            "raw": w,
            "norm": normalize_arabic(w.word),
            "start_ms": int(w.start_ms),
            "end_ms": int(w.end_ms),
        }
        for w in transcript_words
        if normalize_arabic(w.word)
    ]

    # If no valid transcript words, generate fallback
    if not norm_transcript:
        ms_per_verse = audio_duration_ms // len(verses) if audio_duration_ms > 0 else 8000
        fallback_alignments = []
        for i, v in enumerate(verses):
            v_id = str(v.get("id", f"v-{i+1}"))
            start = i * ms_per_verse
            end = (i + 1) * ms_per_verse if i < len(verses) - 1 else max((i + 1) * ms_per_verse, audio_duration_ms)
            fallback_alignments.append(
                VerseAlignmentResult(
                    verse_id=v_id,
                    order_index=i + 1,
                    start_ms=start,
                    end_ms=end,
                    confidence=0.50,
                    status="auto",
                    first_hemistich_end_ms=start + (end - start) // 2,
                    second_hemistich_start_ms=start + (end - start) // 2,
                    first_word_start_ms=start,
                    last_word_end_ms=end,
                )
            )
        return PoemAlignmentResult(
            poem_id=poem_id,
            recording_id=recording_id,
            overall_confidence=0.50,
            alignments=fallback_alignments,
        )

    # 2. Extract normalized tokens per verse and hemistichs
    verse_token_data = []
    for i, v in enumerate(verses):
        v_id = str(v.get("id", f"v-{i+1}"))
        v_text = str(v.get("text", ""))
        first_h = str(v.get("first_hemistich", v.get("firstHemistich", "")))
        second_h = str(v.get("second_hemistich", v.get("secondHemistich", "")))

        if not v_text and (first_h or second_h):
            v_text = f"{first_h} {second_h}".strip()

        all_tokens = tokenize_normalized(v_text)
        first_tokens = tokenize_normalized(first_h)
        second_tokens = tokenize_normalized(second_h)

        verse_token_data.append({
            "id": v_id,
            "order_index": i + 1,
            "tokens": all_tokens,
            "first_tokens": first_tokens,
            "second_tokens": second_tokens,
        })

    # 3. Detect intro offset using first reliably matched poem word
    first_verse_tokens = verse_token_data[0]["tokens"] if verse_token_data else []
    intro_start_idx = find_first_reliable_match(first_verse_tokens, norm_transcript)
    intro_offset_ms = norm_transcript[intro_start_idx]["start_ms"] if norm_transcript else 0

    curr_t_idx = intro_start_idx
    raw_alignments: List[Dict[str, Any]] = []

    for v_idx, v_info in enumerate(verse_token_data):
        tokens = v_info["tokens"]
        if not tokens:
            prev_end = raw_alignments[-1]["end_ms"] if raw_alignments else intro_offset_ms
            raw_alignments.append({
                "info": v_info,
                "start_ms": prev_end,
                "end_ms": prev_end + 8000,
                "first_word_start_ms": prev_end,
                "last_word_end_ms": prev_end + 8000,
                "confidence": 0.5,
                "matched_count": 0,
            })
            continue

        n_tokens = len(tokens)
        best_match_start = curr_t_idx
        best_match_end = min(len(norm_transcript), curr_t_idx + n_tokens)
        best_score = 0.0
        best_matched_count = 0

        max_lookahead = min(len(norm_transcript), curr_t_idx + int(n_tokens * 2.5) + 4)

        for candidate_start in range(curr_t_idx, max(curr_t_idx + 1, max_lookahead - n_tokens + 1)):
            for candidate_end in range(
                candidate_start + max(1, n_tokens - 4),
                min(len(norm_transcript) + 1, candidate_start + n_tokens + 5),
            ):
                window_tokens = [norm_transcript[j]["norm"] for j in range(candidate_start, candidate_end)]
                matcher = SequenceMatcher(None, tokens, window_tokens)
                score = matcher.ratio()

                if score > best_score:
                    best_score = score
                    best_match_start = candidate_start
                    best_match_end = candidate_end
                    best_matched_count = int(score * n_tokens)

        if best_match_end > best_match_start:
            v_start_ms = norm_transcript[best_match_start]["start_ms"]
            v_end_ms = norm_transcript[best_match_end - 1]["end_ms"]
            curr_t_idx = best_match_end
        else:
            prev_end = raw_alignments[-1]["end_ms"] if raw_alignments else intro_offset_ms
            v_start_ms = prev_end
            v_end_ms = prev_end + 8000
            best_score = 0.5

        confidence = max(0.5, min(1.0, best_score))

        raw_alignments.append({
            "info": v_info,
            "start_ms": v_start_ms,
            "end_ms": v_end_ms,
            "first_word_start_ms": v_start_ms,
            "last_word_end_ms": v_end_ms,
            "confidence": confidence,
            "matched_count": best_matched_count,
        })

    # 4. Refine boundaries using nearby VAD silence detection
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
                status="auto",
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
