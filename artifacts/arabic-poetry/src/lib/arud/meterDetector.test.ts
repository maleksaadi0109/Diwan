import { describe, it, expect } from "vitest";
import { analyzeVerseMeter, extractRawiyy } from "./meterDetector";

describe("Arud Meter Detector", () => {
  it("extracts Rawiyy letter correctly", () => {
    expect(extractRawiyy("واحر قلباه ممن قلبه شبم")).toBe("الميم");
    expect(extractRawiyy("أراك عصي الدمع شيمتك الصبر")).toBe("الراء");
    expect(extractRawiyy("لكل شيئ إذا ما تم نقصان")).toBe("النون");
  });

  it("analyzes Bahr and Tafaeel breakdown", () => {
    const result = analyzeVerseMeter(
      "واحَرَّ قَلباهُ مِمَّن قَلبُهُ شَبِمُ",
      "وَمَن بِجِسمي وَحالي عِندَهُ سَقَمُ",
      "البسيط"
    );

    expect(result.bahr).toBe("البسيط");
    expect(result.pattern).toContain("مُسْتَفْعِلُنْ");
    expect(result.tafeelaBreakdown).toHaveLength(4);
    expect(result.rawiyy).toBe("الميم");
    expect(result.confidence).toBeGreaterThan(0.8);
  });
});
