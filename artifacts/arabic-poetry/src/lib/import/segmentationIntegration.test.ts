import { describe, it, expect, beforeEach } from "vitest";
import { DiwanRepository } from "@/lib/db/repository";
import { BetterSqliteAdapter } from "@/lib/db/adapter";
import { Poet, Poem, VerseSegmentationSuggestion } from "@/types";
import { normalizeArabic } from "@/lib/utils";
import { parsePasteExplanationText } from "./pasteExplanationParser";

/**
 * Full pipeline test mirroring the real user flow end to end:
 * paste text -> parser detects a merge/split segmentation suggestion against
 * the poem's *actual* stored verses -> the suggestion is applied through the
 * same repository calls App.tsx's handleApplySegmentationSuggestions makes ->
 * the resulting poem (verse list, order_index, explanations, alignment) is
 * re-fetched and checked for corruption, exactly like re-opening the poem
 * after accepting the fix in the modal.
 */
describe("segmentation suggestion pipeline (paste -> detect -> confirm -> repository)", () => {
  let adapter: BetterSqliteAdapter;
  let repo: DiwanRepository;

  beforeEach(async () => {
    adapter = await BetterSqliteAdapter.create(":memory:");
    repo = new DiwanRepository(adapter);
    await repo.init();
  });

  async function applyAcceptedSuggestions(poemId: string, accepted: VerseSegmentationSuggestion[]) {
    // Mirrors App.tsx's handleApplySegmentationSuggestions repo branch exactly.
    for (const suggestion of accepted) {
      if (suggestion.kind === "hemistich_split") {
        const [verseId] = suggestion.verseIds;
        const [target] = suggestion.suggested;
        await repo.updateVerseText(verseId, target.firstHemistich, target.secondHemistich);
      } else if (suggestion.kind === "merge_verses") {
        const [keepId, removeId] = suggestion.verseIds;
        const [target] = suggestion.suggested;
        await repo.mergeVerses(poemId, keepId, removeId, target.firstHemistich, target.secondHemistich);
      } else if (suggestion.kind === "split_verse") {
        const [verseId] = suggestion.verseIds;
        const [first, second] = suggestion.suggested;
        await repo.splitVerse(poemId, verseId, first, second);
      }
    }
  }

  it("merges an over-split بيت after the pasted explanation quotes it as one line, with no data loss", async () => {
    const poet: Poet = { id: "poet-pipe-1", name: "شاعر الأنابيب", era: "جاهلي" };
    const poem: Poem = {
      id: "poem-pipe-1",
      title: "قصيدة اختبار الأنبوب الكامل",
      poet,
      era: "جاهلي",
      bahr: "الطويل",
      rhyme: "الدال",
      versesCount: 2,
      tags: [],
      recordings: [
        {
          id: "rec-pipe-1",
          poemId: "poem-pipe-1",
          title: "تسجيل",
          reciter: "قارئ",
          audioPath: "recordings/pipe1.mp3",
          durationMs: 15000,
          createdAt: "2026-01-01",
        },
      ],
      verses: [
        {
          id: "p1-v1",
          poemId: "poem-pipe-1",
          orderIndex: 1,
          text: "تَطاوَلَ لَيلُكَ بِالأَثمَدِ الجَميلِ",
          normalizedText: normalizeArabic("تَطاوَلَ لَيلُكَ بِالأَثمَدِ الجَميلِ"),
          firstHemistich: "تَطاوَلَ لَيلُكَ",
          secondHemistich: "بِالأَثمَدِ الجَميلِ",
          alignment: {
            id: "align-p1-v1",
            verseId: "p1-v1",
            recordingId: "rec-pipe-1",
            startMs: 0,
            endMs: 5000,
            confidence: 0.85,
            status: "auto",
          },
        },
        {
          id: "p1-v2",
          poemId: "poem-pipe-1",
          orderIndex: 2,
          text: "وَنامَ الخَلِيُّ وَلَم تَرقُدِ",
          normalizedText: normalizeArabic("وَنامَ الخَلِيُّ وَلَم تَرقُدِ"),
          firstHemistich: "وَنامَ الخَلِيُّ",
          secondHemistich: "وَلَم تَرقُدِ",
          alignment: {
            id: "align-p1-v2",
            verseId: "p1-v2",
            recordingId: "rec-pipe-1",
            startMs: 5000,
            endMs: 9000,
            confidence: 0.85,
            status: "auto",
          },
        },
      ],
    };
    await repo.savePoem(poem);

    const pasted = `شرح قصيدة تطاول ليلك بالأثمد

تَطاوَلَ لَيلُكَ بِالأَثمَدِ الجَميلِ وَنامَ الخَلِيُّ
وَلَم تَرقُدِ

هذا البيت يفتتح القصيدة بشكوى طول الليل.
`;

    // 1. Import time: fetch the poem's *actual* stored verses and parse.
    const storedPoem = await repo.getPoemById("poem-pipe-1");
    expect(storedPoem).not.toBeNull();
    const result = parsePasteExplanationText(pasted, storedPoem!.verses);

    const mergeSuggestion = result.segmentationSuggestions.find((s) => s.kind === "merge_verses");
    expect(mergeSuggestion).toBeTruthy();
    expect(mergeSuggestion!.verseIds).toEqual(["p1-v1", "p1-v2"]);

    // 2. User accepts the suggestion in the modal -> applied via repository.
    await applyAcceptedSuggestions("poem-pipe-1", [mergeSuggestion!]);

    // 3. Re-open the poem (as the UI does after applying) and verify integrity.
    const reopened = await repo.getPoemById("poem-pipe-1");
    expect(reopened).not.toBeNull();
    expect(reopened!.verses).toHaveLength(1);
    expect(reopened!.versesCount).toBe(1);
    expect(reopened!.verses[0].orderIndex).toBe(1);
    expect(reopened!.verses[0].id).toBe("p1-v1");
    expect(reopened!.verses[0].firstHemistich).toBe("تَطاوَلَ لَيلُكَ بِالأَثمَدِ الجَميلِ وَنامَ الخَلِيُّ");
    expect(reopened!.verses[0].secondHemistich).toBe("وَلَم تَرقُدِ");
    // The kept verse's alignment (needed for playback) is untouched.
    expect(reopened!.verses[0].alignment?.id).toBe("align-p1-v1");
    expect(await repo.getAlignmentByVerseId("p1-v2")).toBeNull();
  });

  it("splits an over-merged verse row after the pasted explanation quotes it as two lines, with no data loss", async () => {
    const poet: Poet = { id: "poet-pipe-2", name: "شاعر الأنابيب", era: "جاهلي" };
    const poem: Poem = {
      id: "poem-pipe-2",
      title: "قصيدة اختبار الأنبوب الثاني",
      poet,
      era: "جاهلي",
      bahr: "الطويل",
      rhyme: "الدال",
      versesCount: 2,
      tags: [],
      recordings: [
        {
          id: "rec-pipe-2",
          poemId: "poem-pipe-2",
          title: "تسجيل",
          reciter: "قارئ",
          audioPath: "recordings/pipe2.mp3",
          durationMs: 15000,
          createdAt: "2026-01-01",
        },
      ],
      verses: [
        {
          id: "p2-v1",
          poemId: "poem-pipe-2",
          orderIndex: 1,
          text: "تَطاوَلَ لَيلُكَ بِالأَثمَدِ الجَميلِ وَنامَ الخَلِيُّ وَلَم تَرقُدِ",
          normalizedText: normalizeArabic("تَطاوَلَ لَيلُكَ بِالأَثمَدِ الجَميلِ وَنامَ الخَلِيُّ وَلَم تَرقُدِ"),
          firstHemistich: "تَطاوَلَ لَيلُكَ بِالأَثمَدِ الجَميلِ",
          secondHemistich: "وَنامَ الخَلِيُّ وَلَم تَرقُدِ",
          alignment: {
            id: "align-p2-v1",
            verseId: "p2-v1",
            recordingId: "rec-pipe-2",
            startMs: 0,
            endMs: 9000,
            confidence: 0.85,
            status: "auto",
          },
        },
        {
          id: "p2-v2",
          poemId: "poem-pipe-2",
          orderIndex: 2,
          text: "بيت آخر تالٍ لا علاقة له بما سبق",
          normalizedText: normalizeArabic("بيت آخر تالٍ لا علاقة له بما سبق"),
          firstHemistich: "بيت آخر تالٍ",
          secondHemistich: "لا علاقة له بما سبق",
          alignment: {
            id: "align-p2-v2",
            verseId: "p2-v2",
            recordingId: "rec-pipe-2",
            startMs: 9000,
            endMs: 13000,
            confidence: 0.85,
            status: "auto",
          },
        },
      ],
    };
    await repo.savePoem(poem);

    const pasted = `شرح قصيدة تطاول ليلك بالأثمد

تَطاوَلَ لَيلُكَ بِالأَثمَدِ الجَميلِ

هذا هو الشطر الأول من البيت كما ورد في الشرح.

وَنامَ الخَلِيُّ وَلَم تَرقُدِ

وهذا شطره الثاني، مقتبس هنا كبيت منفصل تماماً.
`;

    const storedPoem = await repo.getPoemById("poem-pipe-2");
    const result = parsePasteExplanationText(pasted, storedPoem!.verses);

    const splitSuggestion = result.segmentationSuggestions.find((s) => s.kind === "split_verse");
    expect(splitSuggestion).toBeTruthy();
    expect(splitSuggestion!.verseIds).toEqual(["p2-v1"]);

    await applyAcceptedSuggestions("poem-pipe-2", [splitSuggestion!]);

    const reopened = await repo.getPoemById("poem-pipe-2");
    expect(reopened).not.toBeNull();
    expect(reopened!.verses).toHaveLength(3);
    expect(reopened!.versesCount).toBe(3);

    const orderIndices = reopened!.verses.map((v) => v.orderIndex).sort((a, b) => a - b);
    expect(orderIndices).toEqual([1, 2, 3]);
    expect(new Set(reopened!.verses.map((v) => v.id)).size).toBe(3);

    const firstHalf = reopened!.verses.find((v) => v.id === "p2-v1");
    expect(firstHalf?.orderIndex).toBe(1);
    expect(firstHalf?.firstHemistich).toBe("تَطاوَلَ لَيلُكَ بِالأَثمَدِ الجَميلِ");
    // Alignment/playback data for the first half survives the split.
    expect(firstHalf?.alignment?.id).toBe("align-p2-v1");

    const newHalf = reopened!.verses.find((v) => v.orderIndex === 2);
    expect(newHalf?.firstHemistich).toBe("وَنامَ الخَلِيُّ وَلَم تَرقُدِ");
    // New verse has no alignment yet — it genuinely needs re-review, this is expected.
    expect(newHalf?.alignment).toBeUndefined();

    const originalNext = reopened!.verses.find((v) => v.id === "p2-v2");
    expect(originalNext?.orderIndex).toBe(3);
    expect(originalNext?.alignment?.id).toBe("align-p2-v2");
  });

  it("applies two split_verse suggestions in the same accepted batch without id collisions overwriting each other", async () => {
    // Regression test: splitVerse's new verse id used to be derived only
    // from `${verseId}-split-${Date.now()}`. Accepting two split_verse
    // suggestions in one batch — a realistic outcome, since the modal lets
    // users check multiple suggestions before confirming — can run both
    // repo.splitVerse() calls within the same millisecond on fast/synchronous
    // adapters, producing identical ids. Because saveVerse uses
    // INSERT OR REPLACE, the second insert would silently overwrite the
    // first split's new verse, losing a user-confirmed correction.
    const poet: Poet = { id: "poet-pipe-3", name: "شاعر الأنابيب", era: "جاهلي" };
    const poem: Poem = {
      id: "poem-pipe-3",
      title: "قصيدة اختبار الدفعة الواحدة",
      poet,
      era: "جاهلي",
      bahr: "الطويل",
      rhyme: "الدال",
      versesCount: 2,
      tags: [],
      recordings: [],
      verses: [
        {
          id: "p3-v1",
          poemId: "poem-pipe-3",
          orderIndex: 1,
          text: "شطر أول لبيت مدموج خطأً - الأول",
          normalizedText: normalizeArabic("شطر أول لبيت مدموج خطأً - الأول"),
          firstHemistich: "شطر أول",
          secondHemistich: "لبيت مدموج خطأً - الأول",
        },
        {
          id: "p3-v2",
          poemId: "poem-pipe-3",
          orderIndex: 2,
          text: "شطر أول لبيت مدموج خطأً - الثاني",
          normalizedText: normalizeArabic("شطر أول لبيت مدموج خطأً - الثاني"),
          firstHemistich: "شطر أول",
          secondHemistich: "لبيت مدموج خطأً - الثاني",
        },
      ],
    };
    await repo.savePoem(poem);

    const suggestions: VerseSegmentationSuggestion[] = [
      {
        id: "sugg-split-1",
        kind: "split_verse",
        verseIds: ["p3-v1"],
        description: "test",
        current: [{ firstHemistich: "شطر أول", secondHemistich: "لبيت مدموج خطأً - الأول" }],
        suggested: [
          { firstHemistich: "شطر أول الأول", secondHemistich: "الجزء الأول من البيت الأول" },
          { firstHemistich: "شطر ثانٍ الأول", secondHemistich: "الجزء الثاني من البيت الأول" },
        ],
      },
      {
        id: "sugg-split-2",
        kind: "split_verse",
        verseIds: ["p3-v2"],
        description: "test",
        current: [{ firstHemistich: "شطر أول", secondHemistich: "لبيت مدموج خطأً - الثاني" }],
        suggested: [
          { firstHemistich: "شطر أول الثاني", secondHemistich: "الجزء الأول من البيت الثاني" },
          { firstHemistich: "شطر ثانٍ الثاني", secondHemistich: "الجزء الثاني من البيت الثاني" },
        ],
      },
    ];
    // Fix the clock so both splitVerse calls land in the exact same
    // millisecond, deterministically reproducing the collision window.
    const fixedNow = Date.now();
    const nowSpy = () => fixedNow;
    const originalDateNow = Date.now;
    Date.now = nowSpy;
    try {
      await applyAcceptedSuggestions("poem-pipe-3", suggestions);
    } finally {
      Date.now = originalDateNow;
    }

    const reopened = await repo.getPoemById("poem-pipe-3");
    expect(reopened).not.toBeNull();
    // Both original verses plus both new halves must all be present — no
    // verse was silently dropped by an id collision.
    expect(reopened!.verses).toHaveLength(4);
    expect(reopened!.versesCount).toBe(4);
    expect(new Set(reopened!.verses.map((v) => v.id)).size).toBe(4);

    const orderIndices = reopened!.verses.map((v) => v.orderIndex).sort((a, b) => a - b);
    expect(orderIndices).toEqual([1, 2, 3, 4]);

    expect(reopened!.verses.some((v) => v.firstHemistich === "شطر ثانٍ الأول")).toBe(true);
    expect(reopened!.verses.some((v) => v.firstHemistich === "شطر ثانٍ الثاني")).toBe(true);
  });
});
