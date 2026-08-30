import { describe, it, expect } from "vitest";
import { parsePasteExplanationText } from "./pasteExplanationParser";
import { Verse } from "@/types";
import { normalizeArabic } from "@/lib/utils";

function makeVerse(id: string, orderIndex: number, first: string, second: string): Verse {
  const text = `${first} ${second}`;
  return {
    id,
    poemId: "poem-1",
    orderIndex,
    text,
    normalizedText: normalizeArabic(text),
    firstHemistich: first,
    secondHemistich: second,
  };
}

const verses: Verse[] = [
  makeVerse("v1", 1, "تَطاوَلَ لَيلُكَ بِالأَثمَدِ", "وَنامَ الخَلِيُّ وَلَم تَرقُدِ"),
  makeVerse("v2", 2, "وَباتَ وَباتَت لَهُ لَيلَةٌ", "كَلَيلَةِ ذي العائِرِ الأَرمَدِ"),
  makeVerse("v3", 3, "وَذَلِكَ مِن نَبَإٍ جاءَني", "وَخُبِّرتُهُ عَن أَبي الأَسوَدِ"),
];

const PASTED = `ملخص قصيدة تطاول ليلك بالأثمد

تهديدٌ صريحٌ بالثأر والحرب رداً على أنباءٍ مؤلمة.

شرح قصيدة تطاول ليلك بالأثمد

تدور القصيدة حول وعيدٍ وتهديدٍ صريحٍ بالثأر.
تَطاوَلَ لَيلُكَ بِالأَثمَدِ
وَنامَ الخَلِيُّ وَلَم تَرقُدِ

يخاطب الشاعر نفسه شاكياً من طول الليل.

    الأثمد: نوع من الكحل.
    الخلي: المرء الخالي من الهموم.
    ترقد: تنام.

وَباتَ وَباتَت لَهُ لَيلَةٌ
كَلَيلَةِ ذي العائِرِ الأَرمَدِ

يصف الشاعر ليلته بأنها كانت طويلة وشاقة.

    بات: قضى ليله.
    العائر: الذكر.
    الأرمد: المصاب بالرمد.
`;

describe("parsePasteExplanationText", () => {
  it("matches verse blocks to the correct verses and extracts prose + glossary", () => {
    const result = parsePasteExplanationText(PASTED, verses);

    expect(result.matched).toHaveLength(2);
    expect(result.matched[0].verseId).toBe("v1");
    expect(result.matched[1].verseId).toBe("v2");
    expect(result.unmatchedVerseBlocks).toHaveLength(0);

    const v1Items = result.matched[0].items;
    const proseItem = v1Items.find((i) => i.explanationType === "manual" && i.text.includes("طول الليل"));
    expect(proseItem).toBeTruthy();

    const glossaryItems = v1Items.filter((i) => i.explanationType === "classical");
    expect(glossaryItems.length).toBeGreaterThanOrEqual(3);
    expect(glossaryItems.some((g) => g.text.startsWith("الأثمد:"))).toBe(true);

    // Poem-level overview text (before the first verse block) attaches to the first matched verse.
    const overviewItem = v1Items.find((i) => i.sourceTitle?.includes("ملخص"));
    expect(overviewItem).toBeTruthy();
    expect(overviewItem!.text).toContain("تهديدٌ صريحٌ بالثأر");
  });

  it("reports unmatched verse blocks that don't correspond to any verse in the poem", () => {
    const withExtra = PASTED + "\n\nوَذَلِكَ مِن نَبَإٍ آخَرَ جاءَني\nمِن غَيرِ هَذي القَصيدَةِ أَبَداً\n\nهذا شرح لبيت غير موجود.\n";
    const result = parsePasteExplanationText(withExtra, verses.slice(0, 2));
    expect(result.unmatchedVerseBlocks.length).toBeGreaterThanOrEqual(1);
  });

  it("throws a clear error for empty input", () => {
    expect(() => parsePasteExplanationText("   ", verses)).toThrow();
  });
});
