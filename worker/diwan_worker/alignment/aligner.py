from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
from difflib import SequenceMatcher
from .normalizer import normalize_arabic, tokenize_normalized
from ..schemas.transcript import TimedWord, TranscriptResult

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
        return d

@dataclass
class PoemAlignmentResult:
    poem_id: str
    recording_id: str
    overall_confidence: float
    alignments: List[VerseAlignmentResult] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "poem_id": self.poem_id,
            "recording_id": self.recording_id,
            "overall_confidence": round(self.overall_confidence, 3),
            "alignments": [a.to_dict() for a in self.alignments],
        }

def token_similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    return SequenceMatcher(None, a, b).ratio()

def align_transcript_to_verses(
    verses: List[Dict[str, Any]],
    transcript_words: List[TimedWord],
    audio_duration_ms: int,
    poem_id: str = "poem",
    recording_id: str = "rec",
) -> PoemAlignmentResult:
    if not verses:
        return PoemAlignmentResult(poem_id=poem_id, recording_id=recording_id, overall_confidence=0.0)

    # 1. Normalize transcribed words
    norm_transcript = [
        {"raw": w, "norm": normalize_arabic(w.word), "start_ms": w.start_ms, "end_ms": w.end_ms}
        for w in transcript_words
        if normalize_arabic(w.word)
    ]

    # If no valid transcript words, generate evenly spaced fallback alignments
    if not norm_transcript:
        ms_per_verse = audio_duration_ms // len(verses) if audio_duration_ms > 0 else 8000
        fallback_alignments = []
        for i, v in enumerate(verses):
            v_id = str(v.get("id", f"v-{i+1}"))
            start = i * ms_per_verse
            end = (i + 1) * ms_per_verse
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

    # 3. Monotonic search for best alignment window
    curr_t_idx = 0
    alignments: List[VerseAlignmentResult] = []
    total_confidence_sum = 0.0

    for v_idx, v_info in enumerate(verse_token_data):
        tokens = v_info["tokens"]
        if not tokens:
            # Fallback for empty verse
            alignments.append(
                VerseAlignmentResult(
                    verse_id=v_info["id"],
                    order_index=v_info["order_index"],
                    start_ms=0,
                    end_ms=0,
                    confidence=0.0,
                )
            )
            continue

        n_tokens = len(tokens)
        # Search window in transcript words starting from curr_t_idx
        best_match_start = curr_t_idx
        best_match_end = min(len(norm_transcript), curr_t_idx + n_tokens)
        best_score = 0.0
        best_matched_count = 0

        # Lookahead window of up to 2 * n_tokens
        max_lookahead = min(len(norm_transcript), curr_t_idx + int(n_tokens * 2.5) + 3)

        for candidate_start in range(curr_t_idx, max(curr_t_idx + 1, max_lookahead - n_tokens + 1)):
            for candidate_end in range(candidate_start + max(1, n_tokens - 3), min(len(norm_transcript) + 1, candidate_start + n_tokens + 4)):
                window_tokens = [norm_transcript[j]["norm"] for j in range(candidate_start, candidate_end)]
                matcher = SequenceMatcher(None, tokens, window_tokens)
                score = matcher.ratio()

                if score > best_score:
                    best_score = score
                    best_match_start = candidate_start
                    best_match_end = candidate_end
                    best_matched_count = int(score * n_tokens)

        # Advance pointer monotonically
        if best_match_end > best_match_start:
            v_start_ms = norm_transcript[best_match_start]["start_ms"]
            v_end_ms = norm_transcript[best_match_end - 1]["end_ms"]
            curr_t_idx = best_match_end
        else:
            # Fallback
            prev_end = alignments[-1].end_ms if alignments else 0
            v_start_ms = prev_end
            v_end_ms = prev_end + 8000
            best_score = 0.5

        # Hemistich split estimation
        duration = max(1000, v_end_ms - v_start_ms)
        h1_len = len(v_info["first_tokens"])
        h2_len = len(v_info["second_tokens"])
        if h1_len + h2_len > 0:
            h1_ratio = h1_len / (h1_len + h2_len)
        else:
            h1_ratio = 0.5

        h1_end_ms = int(v_start_ms + (duration * h1_ratio))
        h2_start_ms = h1_end_ms

        confidence = max(0.5, min(1.0, best_score))
        total_confidence_sum += confidence

        alignments.append(
            VerseAlignmentResult(
                verse_id=v_info["id"],
                order_index=v_info["order_index"],
                start_ms=v_start_ms,
                end_ms=v_end_ms,
                confidence=confidence,
                status="auto",
                first_hemistich_end_ms=h1_end_ms,
                second_hemistich_start_ms=h2_start_ms,
                matched_words_count=best_matched_count,
                total_words_count=n_tokens,
            )
        )

    overall_conf = total_confidence_sum / len(alignments) if alignments else 0.0

    return PoemAlignmentResult(
        poem_id=poem_id,
        recording_id=recording_id,
        overall_confidence=overall_conf,
        alignments=alignments,
    )
