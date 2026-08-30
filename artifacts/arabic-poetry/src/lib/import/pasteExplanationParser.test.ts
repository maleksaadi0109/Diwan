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

  describe("boundary suggestions (merge_verses / split_verse)", () => {
    // v-split-a + v-split-b together are one over-split بيت stored as two rows:
    // the explanation quotes it (correctly) as one بيت spread over two printed
    // lines, but that combined wording only matches the *concatenation* of
    // the two stored rows, not either row alone.
    // Each row's word count is balanced (4 vs 4) so a quote of the combined
    // 8-word بيت scores below the single-verse match threshold (0.55)
    // against either row alone, but above the boundary threshold (0.6)
    // against their concatenation.
    const overSplitVerses: Verse[] = [
      makeVerse("v-split-a", 1, "تَطاوَلَ لَيلُكَ", "بِالأَثمَدِ الجَميلِ"),
      makeVerse("v-split-b", 2, "وَنامَ الخَلِيُّ", "وَلَم تَرقُدِ"),
      makeVerse("v-split-c", 3, "وَذَلِكَ مِن نَبَإٍ جاءَني", "وَخُبِّرتُهُ عَن أَبي الأَسوَدِ"),
    ];

    it("detects merge_verses when a quoted بيت spans two adjacent stored verse rows", () => {
      const pasted = `شرح قصيدة تطاول ليلك بالأثمد

تَطاوَلَ لَيلُكَ بِالأَثمَدِ الجَميلِ وَنامَ الخَلِيُّ
وَلَم تَرقُدِ

هذا الشرح يتناول البيت الأول من القصيدة بتفصيل.
`;
      const result = parsePasteExplanationText(pasted, overSplitVerses);
      const merge = result.segmentationSuggestions.find((s) => s.kind === "merge_verses");
      expect(merge).toBeTruthy();
      expect(merge!.verseIds).toEqual(["v-split-a", "v-split-b"]);
      expect(merge!.suggested).toHaveLength(1);
      // Neither consumed verse remains available for further single-verse matching.
      expect(result.matched.some((m) => m.verseId === "v-split-a" || m.verseId === "v-split-b")).toBe(false);
    });

    // v-merged is a single stored row that actually holds two separate abيات
    // — its text is the exact concatenation of the two halves below.
    const overMergedVerses: Verse[] = [
      makeVerse("v-merged", 1, "تَطاوَلَ لَيلُكَ بِالأَثمَدِ الجَميلِ", "وَنامَ الخَلِيُّ وَلَم تَرقُدِ"),
      makeVerse("v-merged-2", 2, "وَباتَ وَباتَت لَهُ لَيلَةٌ", "كَلَيلَةِ ذي العائِرِ الأَرمَدِ"),
    ];

    it("detects split_verse when two consecutive quoted lines together match one stored verse", () => {
      // Each half is quoted on its own, separated by a short prose aside, so
      // the parser records them as two distinct unmatched quote blocks
      // instead of re-grouping them into a single two-line block.
      const pasted = `شرح قصيدة تطاول ليلك بالأثمد

تَطاوَلَ لَيلُكَ بِالأَثمَدِ الجَميلِ

هذا هو الشطر الأول من البيت كما ورد في الشرح.

وَنامَ الخَلِيُّ وَلَم تَرقُدِ

وهذا شطره الثاني، مقتبس هنا كبيت منفصل تماماً.
`;
      const result = parsePasteExplanationText(pasted, overMergedVerses);
      const split = result.segmentationSuggestions.find((s) => s.kind === "split_verse");
      expect(split).toBeTruthy();
      expect(split!.verseIds).toEqual(["v-merged"]);
      expect(split!.suggested).toHaveLength(2);
      expect(split!.suggested[0].firstHemistich).toContain("تَطاوَلَ");
      expect(split!.suggested[1].firstHemistich).toContain("وَنامَ");
    });

    it("does not raise a boundary suggestion for wording that merely differs, not merges/splits", () => {
      const pasted = `شرح قصيدة أخرى

بيت مختلف تماماً عن القصيدة
لا يطابق أي شيء مخزّن هنا

شرح غير ذي صلة بالقصيدة الأصلية.
`;
      const result = parsePasteExplanationText(pasted, verses);
      expect(result.segmentationSuggestions.filter((s) => s.kind !== "hemistich_split")).toHaveLength(0);
    });
  });
});
