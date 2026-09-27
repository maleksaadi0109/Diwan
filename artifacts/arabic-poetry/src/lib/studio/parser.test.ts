import { describe, it, expect } from "vitest";
import { parsePastedText, formatDraftAsText } from "./parser";
import { countWords, calculateBalanceRatio, extractRhymeLetter } from "./analysis";
import { normalizeArabic } from "../utils";

describe("Studio Parser and Analysis", () => {
  it("should parse normal separated text", () => {
    const text = "شطر أول   شطر ثان\nشطر آخر   شطر أخير";
    const verses = parsePastedText(text);
    expect(verses).toHaveLength(2);
    expect(verses[0].firstHemistich).toBe("شطر أول");
    expect(verses[0].secondHemistich).toBe("شطر ثان");
  });

  it("should split single line without separators evenly by words", () => {
    const text = "واحد اثنان ثلاثة أربعة";
    const verses = parsePastedText(text);
    expect(verses[0].firstHemistich).toBe("واحد اثنان");
    expect(verses[0].secondHemistich).toBe("ثلاثة أربعة");
  });

  it("should format back to text", () => {
    const verses = [{ id: '1', firstHemistich: 'شطر 1', secondHemistich: 'شطر 2' }];
    const str = formatDraftAsText(verses);
    expect(str).toBe("شطر 1\t\tشطر 2");
  });

  it("should count words properly", () => {
    expect(countWords(" كلمة  كلمتين  ")).toBe(2);
  });

  it("should extract correct rhyme letter", () => {
    expect(extractRhymeLetter("علا المجد")).toBe("د");
    expect(extractRhymeLetter("ينتهي بحرف القافِ")).toBe("ف");
  });
  
  it("should calculate balance correctly", () => {
    // 5 chars / 5 chars
    const r = calculateBalanceRatio("كلمات", "حروفى");
    expect(r).toBe(5 / 5); // 1.0
  });
});
