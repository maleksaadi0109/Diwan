"""
Boundary refinement between verses.

The boundary between verse i and verse i+1 is placed just before the first
word of verse i+1 (anchor-based), never at the midpoint of a long silence:
the previous verse stays highlighted while the reciter pauses. A VAD silence
that covers the inter-verse gap raises boundary confidence; silences *inside*
a verse are never chosen as boundaries because candidates are restricted to
the gap between the last matched word of verse i and the first matched word
of verse i+1.
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import List, Dict, Any, Optional, Tuple
from ..audio.vad import AudioRegion

# Switch the highlight this many ms before the next verse's first word starts.
BOUNDARY_LEAD_MS = 100
# Minimum silence duration considered a real inter-verse pause.
MIN_BOUNDARY_SILENCE_MS = 250
# Every verse keeps a strictly positive span even when ASR timestamps
# overlap or interpolation lands in a zero-width gap; anchored boundaries
# are moved by the minimum amount necessary (1ms), never by a fixed pad.
MIN_POSITIVE_SPAN_MS = 1

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
    method: str  # 'vad' | 'anchor' | 'asr' | 'interpolated'

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

def _find_gap_silence(
    silence_regions: List[AudioRegion],
    gap_start_ms: int,
    gap_end_ms: int,
) -> Optional[AudioRegion]:
    """Largest silence that overlaps the inter-verse gap (never inside a verse)."""
    best: Optional[AudioRegion] = None
    for sil in silence_regions:
        ov_start = max(sil.start_ms, gap_start_ms)
        ov_end = min(sil.end_ms, gap_end_ms)
        overlap = ov_end - ov_start
        if overlap >= MIN_BOUNDARY_SILENCE_MS:
            if best is None or overlap > (min(best.end_ms, gap_end_ms) - max(best.start_ms, gap_start_ms)):
                best = sil
    return best

def refine_boundaries_with_silence(
    raw_verse_alignments: List[Dict[str, Any]],
    silence_regions: List[AudioRegion],
    audio_duration_ms: int,
    lead_time_ms: int = BOUNDARY_LEAD_MS,
) -> Tuple[List[Dict[str, Any]], List[VerseSyncDiagnostic]]:
    if not raw_verse_alignments:
        return [], []

    refined: List[Dict[str, Any]] = []
    diagnostics: List[VerseSyncDiagnostic] = []
    n = len(raw_verse_alignments)

    current_start = raw_verse_alignments[0]["start_ms"]

    for i in range(n):
        curr = raw_verse_alignments[i]
        info = curr["info"]
        v_id = info["id"]
        order_idx = info["order_index"]
        asr_end = curr["last_word_end_ms"]
        anchored = bool(curr.get("anchored", True))

        sil_start_rec: Optional[int] = None
        sil_end_rec: Optional[int] = None

        if i < n - 1:
            nxt = raw_verse_alignments[i + 1]
            next_first = nxt["first_word_start_ms"]
            gap_start = curr["last_word_end_ms"]

            if next_first > gap_start:
                # Boundary sits just before the next verse's first word,
                # so silence in the gap keeps THIS verse highlighted.
                boundary = max(gap_start, next_first - lead_time_ms)
                method = "anchor"
                confidence = curr["confidence"]
                sil = _find_gap_silence(silence_regions, gap_start, next_first)
                if sil is not None:
                    method = "vad"
                    sil_start_rec = sil.start_ms
                    sil_end_rec = sil.end_ms
                    confidence = min(1.0, confidence + 0.05)
            else:
                # Overlapping/touching words: fall back to midpoint
                boundary = (gap_start + next_first) // 2 if next_first < gap_start else gap_start
                method = "asr"
                confidence = curr["confidence"]

            boundary = max(boundary, current_start)
            final_end = boundary
            next_start = boundary
        else:
            final_end = curr["last_word_end_ms"] + 500
            if audio_duration_ms > 0:
                final_end = min(max(final_end, curr["last_word_end_ms"]), audio_duration_ms)
            final_end = max(final_end, current_start)
            next_start = final_end
            method = "anchor" if anchored else "interpolated"
            confidence = curr["confidence"]

        if not anchored:
            method = "interpolated"

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

        # Hemistich split: prefer anchor-derived split, else word-count ratio
        split = curr.get("hemistich_split_ms")
        if split is None or not (current_start < split < final_end):
            duration = max(1, final_end - current_start)
            h1_len = len(info["first_tokens"])
            h2_len = len(info["second_tokens"])
            h1_ratio = h1_len / (h1_len + h2_len) if (h1_len + h2_len) > 0 else 0.5
            split = int(current_start + duration * h1_ratio)

        status = "auto" if anchored else "review"

        refined.append({
            "verse_id": v_id,
            "order_index": order_idx,
            "start_ms": current_start,
            "end_ms": final_end,
            "confidence": confidence,
            "status": status,
            "first_hemistich_end_ms": split,
            "second_hemistich_start_ms": split,
            "matched_words_count": curr["matched_count"],
            "total_words_count": len(info["tokens"]),
            "first_word_start_ms": curr["first_word_start_ms"],
            "last_word_end_ms": curr["last_word_end_ms"],
            "diagnostic": diag.to_dict(),
        })

        current_start = next_start

    # --- Boundary-chain normalization -------------------------------------
    # Guarantees, in priority order:
    #   1. end_ms <= audio_duration_ms for every verse (hard bound)
    #   2. strictly positive spans (end > start) whenever the recording allows
    #   3. monotonic non-decreasing boundaries
    # Anchored timestamps are only moved by the minimum needed (1ms steps),
    # never padded by a fixed amount.
    chain = [refined[0]["start_ms"]] + [r["end_ms"] for r in refined]
    chain[0] = max(0, chain[0])
    for i in range(1, n + 1):
        chain[i] = max(chain[i], chain[i - 1] + MIN_POSITIVE_SPAN_MS)
    if audio_duration_ms > 0 and chain[n] > audio_duration_ms:
        chain[n] = audio_duration_ms
        for i in range(n - 1, -1, -1):
            chain[i] = min(chain[i], chain[i + 1] - MIN_POSITIVE_SPAN_MS)
        chain[0] = max(0, chain[0])
        for i in range(1, n + 1):
            # Re-assert monotonicity; cap at the recording length so the
            # duration bound is never violated even for degenerate audio.
            lower = chain[i - 1] + MIN_POSITIVE_SPAN_MS
            chain[i] = max(chain[i], min(lower, audio_duration_ms))

    for i, r in enumerate(refined):
        start, end = chain[i], chain[i + 1]
        if r["start_ms"] != start or r["end_ms"] != end:
            r["start_ms"] = start
            r["end_ms"] = end
            split = r["first_hemistich_end_ms"]
            if not (start < split < end):
                split = start + max(1, (end - start) // 2)
            r["first_hemistich_end_ms"] = split
            r["second_hemistich_start_ms"] = split
            r["diagnostic"]["final_end_ms"] = end
            diagnostics[i].final_end_ms = end
            if i < n - 1:
                r["diagnostic"]["next_verse_start_ms"] = chain[i + 1]
                diagnostics[i].next_verse_start_ms = chain[i + 1]

    return refined, diagnostics
