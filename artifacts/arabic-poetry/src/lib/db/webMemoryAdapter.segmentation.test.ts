import { describe, it, expect, beforeEach } from "vitest";
import { DiwanRepository } from "./repository";
import { WebMemoryAdapter } from "./adapter";
import { Poet, Poem } from "@/types";
import { normalizeArabic } from "@/lib/utils";

/**
 * The browser/preview build (and Tauri fallback) runs on WebMemoryAdapter,
 * not the SQLite adapter used by repository.test.ts. Its `execute()` method
 * hand-parses each SQL statement into its own in-memory Map mutation, so the
 * order_index shifting / delete / text-update branches it added for
 * mergeVerses/splitVerse need their own coverage independent of SQLite.
 */
describe("DiwanRepository segmentation corrections on WebMemoryAdapter", () => {
  let adapter: WebMemoryAdapter;
  let repo: DiwanRepository;

  beforeEach(async () => {
    adapter = new WebMemoryAdapter();
    repo = new DiwanRepository(adapter);
    await repo.init();
  });

  async function seedPoem(): Promise<Poem> {
    const poet: Poet = { id: "poet-web-seg", name: "شاعر", era: "جاهلي" };
    const poem: Poem = {
      id: "poem-web-seg",
      title: "قصيدة اختبار المحول الذاكري",
      poet,
      era: "جاهلي",
      bahr: "الطويل",
      rhyme: "الدال",
      versesCount: 3,
      tags: [],
      recordings: [
        {
          id: "rec-web-seg",
          poemId: "poem-web-seg",
          title: "تسجيل",
          reciter: "قارئ",
          audioPath: "recordings/web-seg.mp3",
          durationMs: 30000,
          createdAt: "2026-01-01",
        },
      ],
      verses: [
        {
          id: "w-v-1",
          poemId: "poem-web-seg",
          orderIndex: 1,
          text: "بيت كامل غير متأثر بالتصحيح",
          normalizedText: normalizeArabic("بيت كامل غير متأثر بالتصحيح"),
          firstHemistich: "بيت كامل",
          secondHemistich: "غير متأثر بالتصحيح",
          alignment: {
            id: "align-w-1",
            verseId: "w-v-1",
            recordingId: "rec-web-seg",
            startMs: 0,
            endMs: 4000,
            confidence: 0.9,
            status: "reviewed",
          },
        },
        {
          id: "w-v-2",
          poemId: "poem-web-seg",
          orderIndex: 2,
          text: "شطر أول لبيت مقسوم خطأ",
          normalizedText: normalizeArabic("شطر أول لبيت مقسوم خطأ"),
          firstHemistich: "شطر أول",
          secondHemistich: "لبيت مقسوم خطأ",
          alignment: {
            id: "align-w-2",
            verseId: "w-v-2",
            recordingId: "rec-web-seg",
            startMs: 4000,
            endMs: 8000,
            confidence: 0.8,
            status: "auto",
          },
        },
        {
          id: "w-v-3",
          poemId: "poem-web-seg",
          orderIndex: 3,
          text: "شطر ثانٍ لنفس البيت المقسوم خطأ",
          normalizedText: normalizeArabic("شطر ثانٍ لنفس البيت المقسوم خطأ"),
          firstHemistich: "شطر ثانٍ",
          secondHemistich: "لنفس البيت المقسوم خطأ",
          alignment: {
            id: "align-w-3",
            verseId: "w-v-3",
            recordingId: "rec-web-seg",
            startMs: 8000,
            endMs: 12000,
            confidence: 0.8,
            status: "auto",
          },
        },
      ],
    };
    await repo.savePoem(poem);
    await repo.saveVerseExplanations("w-v-2", [
      {
        id: "exp-w-2",
        verseId: "w-v-2",
        text: "شرح الشطر الأول.",
        explanationType: "manual",
        provider: "manual_paste",
      },
    ]);
    await repo.saveVerseExplanations("w-v-3", [
      {
        id: "exp-w-3",
        verseId: "w-v-3",
        text: "شرح الشطر الثاني.",
        explanationType: "manual",
        provider: "manual_paste",
      },
    ]);
    return poem;
  }

  it("mergeVerses on WebMemoryAdapter renumbers order_index and preserves explanations with no orphaned rows", async () => {
    await seedPoem();

    await repo.mergeVerses(
      "poem-web-seg",
      "w-v-2",
      "w-v-3",
      "شطر أول لبيت مقسوم خطأ",
      "شطر ثانٍ لنفس البيت المقسوم خطأ"
    );

    const poem = await repo.getPoemById("poem-web-seg");
    expect(poem).not.toBeNull();
    expect(poem!.verses).toHaveLength(2);
    expect(poem!.versesCount).toBe(2);

    const orderIndices = poem!.verses.map((v) => v.orderIndex).sort((a, b) => a - b);
    expect(orderIndices).toEqual([1, 2]);
    expect(new Set(orderIndices).size).toBe(2);

    expect(poem!.verses.find((v) => v.id === "w-v-3")).toBeUndefined();
    const merged = poem!.verses.find((v) => v.id === "w-v-2");
    expect(merged?.explanations?.length).toBe(2);

    const orphanedAlignment = await repo.getAlignmentByVerseId("w-v-3");
    expect(orphanedAlignment).toBeNull();
    const orphanedExplanations = await repo.getVerseExplanationsByVerseId("w-v-3");
    expect(orphanedExplanations).toHaveLength(0);
  });

  it("splitVerse on WebMemoryAdapter shifts later verses and inserts a contiguous new row", async () => {
    await seedPoem();

    const newVerseId = await repo.splitVerse(
      "poem-web-seg",
      "w-v-2",
      { firstHemistich: "شطر أول", secondHemistich: "لبيت مقسوم خطأ" },
      { firstHemistich: "بيت جديد مستقل", secondHemistich: "كان مدموجاً خطأ" }
    );

    const poem = await repo.getPoemById("poem-web-seg");
    expect(poem).not.toBeNull();
    expect(poem!.verses).toHaveLength(4);
    expect(poem!.versesCount).toBe(4);

    const orderIndices = poem!.verses.map((v) => v.orderIndex).sort((a, b) => a - b);
    expect(orderIndices).toEqual([1, 2, 3, 4]);
    expect(new Set(orderIndices).size).toBe(4);

    const newVerse = poem!.verses.find((v) => v.id === newVerseId);
    expect(newVerse?.orderIndex).toBe(3);
    expect(newVerse?.alignment).toBeUndefined();
    expect(newVerse?.explanations).toBeUndefined();

    const shifted = poem!.verses.find((v) => v.id === "w-v-3");
    expect(shifted?.orderIndex).toBe(4);
    expect(shifted?.alignment?.id).toBe("align-w-3");

    const firstHalf = poem!.verses.find((v) => v.id === "w-v-2");
    expect(firstHalf?.orderIndex).toBe(2);
    expect(firstHalf?.alignment?.id).toBe("align-w-2");
    expect(firstHalf?.explanations?.some((e) => e.id === "exp-w-2")).toBe(true);
  });

  it("snapshotPoemVerses/replacePoemVerses on WebMemoryAdapter preserve alignments across every recording through an undo round trip", async () => {
    const poet: Poet = { id: "poet-web-multi-rec", name: "شاعر متعدد التسجيلات", era: "أموي" };
    const poem: Poem = {
      id: "poem-web-multi-rec",
      title: "قصيدة بتسجيلين على المحول الذاكري",
      poet,
      era: "أموي",
      bahr: "الطويل",
      rhyme: "اللام",
      versesCount: 1,
      tags: [],
      recordings: [
        {
          id: "web-rec-a",
          poemId: "poem-web-multi-rec",
          title: "التسجيل الافتراضي",
          reciter: "قارئ أ",
          audioPath: "recordings/web-a.mp3",
          durationMs: 20000,
          createdAt: "2026-01-01",
        },
        {
          id: "web-rec-b",
          poemId: "poem-web-multi-rec",
          title: "تسجيل ثانٍ",
          reciter: "قارئ ب",
          audioPath: "recordings/web-b.mp3",
          durationMs: 22000,
          createdAt: "2026-01-02",
        },
      ],
      defaultRecordingId: "web-rec-a",
      verses: [
        {
          id: "w-multi-1",
          poemId: "poem-web-multi-rec",
          orderIndex: 1,
          text: "بيت له تسجيلان",
          normalizedText: normalizeArabic("بيت له تسجيلان"),
          firstHemistich: "بيت له",
          secondHemistich: "تسجيلان",
        },
      ],
    };
    await repo.savePoem(poem);
    // Every verse has alignments against *both* recordings -- getPoemById
    // only surfaces the default recording's alignment via `Verse.alignment`,
    // but a snapshot/restore round trip must not silently drop the other.
    await repo.saveAlignment({
      id: "web-align-a",
      verseId: "w-multi-1",
      recordingId: "web-rec-a",
      startMs: 0,
      endMs: 4000,
      confidence: 0.9,
      status: "reviewed",
    });
    await repo.saveAlignment({
      id: "web-align-b",
      verseId: "w-multi-1",
      recordingId: "web-rec-b",
      startMs: 0,
      endMs: 4300,
      confidence: 0.85,
      status: "auto",
    });

    const snapshot = await repo.snapshotPoemVerses("poem-web-multi-rec");
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0].alignments).toHaveLength(2);

    // Simulate an undo/redo round trip: delete the verse, then restore.
    await repo.deleteVerse("poem-web-multi-rec", "w-multi-1");
    expect(await repo.getVersesByPoemId("poem-web-multi-rec")).toHaveLength(0);

    await repo.replacePoemVerses("poem-web-multi-rec", snapshot);

    const restoredAlignments = await repo.getAlignmentsByVerseId("w-multi-1");
    expect(restoredAlignments.map((a) => a.id).sort()).toEqual(["web-align-a", "web-align-b"]);
    expect(restoredAlignments.find((a) => a.recordingId === "web-rec-b")?.endMs).toBe(4300);
  });
});
