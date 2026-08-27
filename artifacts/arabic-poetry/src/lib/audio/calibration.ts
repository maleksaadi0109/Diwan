import { Verse } from "@/types";

export interface SyncAnchor {
  verseId: string;
  originalStartMs: number;
  actualAudioMs: number;
}

export interface CalibrationResult {
  type: "constant" | "progressive";
  globalOffsetMs: number;
  driftScale: number;
  anchor1?: SyncAnchor;
  anchor2?: SyncAnchor;
}

/**
 * Calculates synchronization calibration between original verse alignments and actual audio.
 * - If 1 anchor is provided, computes constant offset.
 * - If 2 anchors are provided, computes progressive drift scale and anchor offset.
 */
export function calculateCalibration(
  anchor1: SyncAnchor,
  anchor2?: SyncAnchor
): CalibrationResult {
  if (!anchor2 || anchor1.verseId === anchor2.verseId || anchor1.originalStartMs === anchor2.originalStartMs) {
    const globalOffsetMs = anchor1.actualAudioMs - anchor1.originalStartMs;
    return {
      type: "constant",
      globalOffsetMs,
      driftScale: 1.0,
      anchor1,
    };
  }

  const origDelta = anchor2.originalStartMs - anchor1.originalStartMs;
  const actualDelta = anchor2.actualAudioMs - anchor1.actualAudioMs;
  const driftScale = origDelta !== 0 ? actualDelta / origDelta : 1.0;
  const globalOffsetMs = anchor1.actualAudioMs - anchor1.originalStartMs;

  const isProgressive = Math.abs(driftScale - 1.0) > 0.005;

  return {
    type: isProgressive ? "progressive" : "constant",
    globalOffsetMs,
    driftScale,
    anchor1,
    anchor2,
  };
}

/**
 * Applies calibration math to a given millisecond timestamp.
 * - Constant offset: corrected_ms = original_ms + global_offset_ms
 * - Progressive drift: corrected_ms = anchorStart + (original_ms - anchorStart) * scale
 */
export function applyCalibrationToTimestamp(
  originalMs: number,
  calibration: CalibrationResult
): number {
  if (calibration.type === "progressive" && calibration.anchor1) {
    const anchorOrig = calibration.anchor1.originalStartMs;
    const anchorActual = calibration.anchor1.actualAudioMs;
    const corrected = anchorActual + (originalMs - anchorOrig) * calibration.driftScale;
    return Math.max(0, Math.round(corrected));
  }

  return Math.max(0, Math.round(originalMs + calibration.globalOffsetMs));
}

/**
 * Calibrates all verses in a poem using the computed calibration profile.
 */
export function calibrateVerses(
  verses: Verse[],
  calibration: CalibrationResult
): Verse[] {
  return verses.map((v) => {
    if (!v.alignment) return v;

    const newStart = applyCalibrationToTimestamp(v.alignment.startMs, calibration);
    const newEnd = applyCalibrationToTimestamp(v.alignment.endMs, calibration);

    return {
      ...v,
      alignment: {
        ...v.alignment,
        startMs: newStart,
        endMs: Math.max(newStart + 500, newEnd),
        status: "reviewed",
      },
    };
  });
}
