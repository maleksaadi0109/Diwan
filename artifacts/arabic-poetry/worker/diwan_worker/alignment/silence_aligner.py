from __future__ import annotations
import math
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
from ..schemas.transcript import TimedWord
from ..audio.vad import AudioRegion, VadAnalysisResult

@dataclass
class VerseSyncDiagnostic:
    verse_id: str
    order_index: int
    asr_end_ms: int
    detected_silence_start_ms: Optional[int]
    detected_silence_end_ms: Optional[int]
    final_end_ms: int
    next_verse_start_ms: int
    boundary_confidence: float
    method: str  # 'vad' | 'asr' | 'manual'

    def to_dict(self) -> Dict[str, Any]:
        return {
            "verse_id": self.verse_id,
            "order_index": self.order_index,
            "asr_end_ms": self.asr_end_ms,
            "detected_silence_start_ms": self.detected_silence_start_ms,
            "detected_silence_end_ms": self.detected_silence_end_ms,
            "final_end_ms": self.final_end_ms,
            "next_verse_start_ms": self.next_verse_start_ms,
            "boundary_confidence": round(self.boundary_confidence, 3),
            "method": self.method,
        }

def score_silence_candidate(
    silence: AudioRegion,
    asr_boundary_ms: int,
    min_silence_ms: int = 280,
    max_useful_pause_ms: int = 2500,
    search_window_ms: int = 1500,
) -> float:
    """
    Computes boundary score:
    score = 0.45 * silenceDurationScore + 0.35 * distanceFromAsrBoundaryScore + 0.20 * nextSpeechConfidenceScore
    """
    # 1. Duration score (normalized between min_silence_ms and 1200ms)
    dur = silence.duration_ms
    if dur < min_silence_ms:
        return 0.0
    duration_score = min(1.0, max(0.2, (dur - min_silence_ms) / 1000.0 + 0.4))

    # 2. Distance score (closer to ASR boundary -> higher score)
    silence_mid = (silence.start_ms + silence.end_ms) / 2.0
    dist = abs(silence_mid - asr_boundary_ms)
    if dist > search_window_ms:
        return 0.0
    distance_score = max(0.0, 1.0 - (dist / search_window_ms))

    # 3. Next speech confidence score
    confidence_score = silence.confidence

    score = (
        0.45 * duration_score +
        0.35 * distance_score +
        0.20 * confidence_score
    )
    return score

def refine_boundaries_with_silence(
    raw_verse_alignments: List[Dict[str, Any]],
    silence_regions: List[AudioRegion],
    audio_duration_ms: int,
    search_window_ms: int = 1500,
    lead_time_ms: int = 100,
) -> Tuple[List[Dict[str, Any]], List[VerseSyncDiagnostic]]:
    """
    Refines ASR verse boundaries using nearby VAD silence detection.
    Sets nextVerse.start_ms = max(silenceStart, silenceEnd - 100).
    Keeps first verse start timestamp intact.
    """
    if not raw_verse_alignments:
        return [], []

    refined_alignments: List[Dict[str, Any]] = []
    diagnostics: List[VerseSyncDiagnostic] = []
    n_verses = len(raw_verse_alignments)

    # First verse start remains exact
    first_v_start = raw_verse_alignments[0]["start_ms"]

    current_verse_start = first_v_start

    for i in range(n_verses):
        curr = raw_verse_alignments[i]
        asr_end = curr["last_word_end_ms"]
        v_id = curr["info"]["id"]
        order_idx = curr["info"]["order_index"]

        if i < n_verses - 1:
            nxt = raw_verse_alignments[i + 1]
            asr_midpoint = (curr["last_word_end_ms"] + nxt["first_word_start_ms"]) // 2

            # Search for candidate silences within search_window_ms (±1500ms) of ASR midpoint
            candidate_silences: List[Tuple[AudioRegion, float]] = []
            for sil in silence_regions:
                # Must occur after current speech start and before next speech end
                if sil.start_ms >= curr["first_word_start_ms"] and sil.end_ms <= nxt["last_word_end_ms"] + 1000:
                    sc = score_silence_candidate(sil, asr_midpoint, search_window_ms=search_window_ms)
                    if sc > 0.35:
                        candidate_silences.append((sil, sc))

            if candidate_silences:
                # Pick best scoring silence
                best_sil, best_sc = max(candidate_silences, key=lambda x: x[1])
                sil_start = best_sil.start_ms
                sil_end = best_sil.end_ms

                # Switch ~100ms before next speech begins, keeping previous verse highlighted during silence
                next_start = max(sil_start, sil_end - lead_time_ms)
                final_end = next_start
                method = "vad"
                confidence = min(1.0, max(curr["confidence"], best_sc))
                sil_start_rec = sil_start
                sil_end_rec = sil_end
            else:
                # Fallback to ASR midpoint
                next_start = asr_midpoint
                final_end = asr_midpoint
                method = "asr"
                confidence = curr["confidence"]
                sil_start_rec = None
                sil_end_rec = None
        else:
            # Final verse extends up to end of recording or last word + 500ms
            final_end = max(curr["last_word_end_ms"] + 500, min(audio_duration_ms, curr["last_word_end_ms"] + 1500))
            if audio_duration_ms > 0 and final_end > audio_duration_ms:
                final_end = audio_duration_ms
            next_start = final_end
            method = "asr"
            confidence = curr["confidence"]
            sil_start_rec = None
            sil_end_rec = None

        diag = VerseSyncDiagnostic(
            verse_id=v_id,
            order_index=order_idx,
            asr_end_ms=asr_end,
            detected_silence_start_ms=sil_start_rec,
            detected_silence_end_ms=sil_end_rec,
            final_end_ms=final_end,
            next_verse_start_ms=next_start,
            boundary_confidence=confidence,
            method=method,
        )
        diagnostics.append(diag)

        duration = max(1000, final_end - current_verse_start)
        h1_len = len(curr["info"]["first_tokens"])
        h2_len = len(curr["info"]["second_tokens"])
        h1_ratio = h1_len / (h1_len + h2_len) if (h1_len + h2_len) > 0 else 0.5
        h1_end = int(current_verse_start + (duration * h1_ratio))

        refined_alignments.append({
            "verse_id": v_id,
            "order_index": order_idx,
            "start_ms": current_verse_start,
            "end_ms": final_end,
            "confidence": confidence,
            "status": "auto",
            "first_hemistich_end_ms": h1_end,
            "second_hemistich_start_ms": h1_end,
            "matched_words_count": curr["matched_count"],
            "total_words_count": len(curr["info"]["tokens"]),
            "first_word_start_ms": curr["first_word_start_ms"],
            "last_word_end_ms": curr["last_word_end_ms"],
            "diagnostic": diag.to_dict(),
        })

        current_verse_start = next_start

    return refined_alignments, diagnostics
