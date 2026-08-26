import { describe, it, expect } from "vitest";
import {
  calculateCalibration,
  applyCalibrationToTimestamp,
  calibrateVerses,
  SyncAnchor,
} from "./calibration";
import { Verse } from "@/types";

describe("Audio-to-Verse Synchronization and Calibration", () => {
  it("verifies milliseconds / seconds conversion boundary", () => {
    const audioCurrentTimeSeconds = 2.458;
    const currentMs = Math.round(audioCurrentTimeSeconds * 1000);
    expect(currentMs).toBe(2458);

    const convertedBackSeconds = currentMs / 1000;
    expect(convertedBackSeconds).toBeCloseTo(2.458, 3);
  });

  it("calculates and applies constant offset correction", () => {
    // Audio starts 1500ms late due to reciter intro
    const anchor1: SyncAnchor = {
      verseId: "v-1",
      originalStartMs: 2500,
      actualAudioMs: 4000,
    };

    const calibration = calculateCalibration(anchor1);
    expect(calibration.type).toBe("constant");
    expect(calibration.globalOffsetMs).toBe(1500);
    expect(calibration.driftScale).toBe(1.0);

    // Apply offset to verse 2 (original start: 10000ms -> should be 11500ms)
    const correctedV2Start = applyCalibrationToTimestamp(10000, calibration);
    expect(correctedV2Start).toBe(11500);
  });

  it("calculates and applies progressive drift scale from 2 anchors", () => {
    // Anchor 1: Verse 1 starts at 2000ms (originally 2000ms)
    const anchor1: SyncAnchor = {
      verseId: "v-1",
      originalStartMs: 2000,
      actualAudioMs: 2000,
    };

    // Anchor 2: Verse 10 starts at 92000ms (originally 90000ms -> drift of +2000ms over 88s)
    const anchor2: SyncAnchor = {
      verseId: "v-10",
      originalStartMs: 90000,
      actualAudioMs: 92000,
    };

    const calibration = calculateCalibration(anchor1, anchor2);
    expect(calibration.type).toBe("progressive");
    expect(calibration.driftScale).toBeCloseTo(90000 / 88000, 4);

    // Verse in middle (originally at 46000ms -> (46000-2000)*(90/88) + 2000 = 47000ms)
    const correctedMid = applyCalibrationToTimestamp(46000, calibration);
    expect(correctedMid).toBe(47000);
  });

  it("calibrates all verses in a poem", () => {
    const mockVerses: Verse[] = [
      {
        id: "v-1",
        poemId: "p-1",
        orderIndex: 1,
        text: "البيت الأول",
        normalizedText: "البيت الاول",
        firstHemistich: "الشطر الأول",
        secondHemistich: "الشطر الثاني",
        alignment: {
          id: "a-1",
          verseId: "v-1",
          recordingId: "r-1",
          startMs: 2000,
          endMs: 9000,
          confidence: 0.95,
          status: "auto",
        },
      },
      {
        id: "v-2",
        poemId: "p-1",
        orderIndex: 2,
        text: "البيت الثاني",
        normalizedText: "البيت الثاني",
        firstHemistich: "الشطر الأول",
        secondHemistich: "الشطر الثاني",
        alignment: {
          id: "a-2",
          verseId: "v-2",
          recordingId: "r-1",
          startMs: 9000,
          endMs: 16000,
          confidence: 0.92,
          status: "auto",
        },
      },
    ];

    const calibration = calculateCalibration({
      verseId: "v-1",
      originalStartMs: 2000,
      actualAudioMs: 2500, // +500ms offset
    });

    const calibrated = calibrateVerses(mockVerses, calibration);
    expect(calibrated[0].alignment?.startMs).toBe(2500);
    expect(calibrated[0].alignment?.endMs).toBe(9500);
    expect(calibrated[1].alignment?.startMs).toBe(9500);
    expect(calibrated[1].alignment?.endMs).toBe(16500);
  });
});
