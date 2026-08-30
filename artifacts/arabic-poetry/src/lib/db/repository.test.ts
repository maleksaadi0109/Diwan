import { describe, it, expect, beforeEach } from "vitest";
import { DiwanRepository } from "./repository";
import { BetterSqliteAdapter } from "./adapter";
import { Poet, Poem, WordDefinition, ImportJob } from "@/types";
import { normalizeArabic } from "@/lib/utils";

describe("Diwan SQLite Repository", () => {
  let adapter: BetterSqliteAdapter;
  let repo: DiwanRepository;

  beforeEach(async () => {
    adapter = await BetterSqliteAdapter.create(":memory:");
    repo = new DiwanRepository(adapter);
    await repo.init();
  });

  it("initializes schema migrations cleanly", async () => {
    // Verify tables exist
    const tables = await adapter.select<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
    );
    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain("poets");
    expect(tableNames).toContain("poems");
    expect(tableNames).toContain("verses");
    expect(tableNames).toContain("recordings");
    expect(tableNames).toContain("verse_alignments");
    expect(tableNames).toContain("word_definitions");
    expect(tableNames).toContain("meter_analyses");
    expect(tableNames).toContain("import_jobs");
  });

  it("seeds database idempotently", async () => {
    await repo.seed();
    const firstCount = (await repo.getAllPoems()).length;
    expect(firstCount).toBeGreaterThan(0);

    // Re-running seed must not throw and must keep same count
    await repo.seed();
    const secondCount = (await repo.getAllPoems()).length;
    expect(secondCount).toBe(firstCount);
  });

  it("performs full CRUD for Poet and Poem with Verses and Alignments", async () => {
    const poet: Poet = {
      id: "poet-test-1",
      name: "عنترة بن شداد",
      era: "جاهلي",
      bio: "فارس وشاعر جاهلي شهير من أصحاب المعلقات.",
    };

    const poem: Poem = {
      id: "poem-test-1",
      title: "هل غادر الشعراء من متردم",
      poet,
      era: "جاهلي",
      bahr: "الكامل",
      rhyme: "الميم المكسورة (ـمِ)",
      versesCount: 1,
      tags: ["معلقة", "فروسية"],
      recordings: [
        {
          id: "rec-test-1",
          poemId: "poem-test-1",
          title: "تسجيل صوتي تجريبي",
          reciter: "قارئ معتمد",
          audioPath: "recordings/antara.mp3",
          durationMs: 15000,
          createdAt: "2026-01-01",
        },
      ],
      verses: [
        {
          id: "v-test-1",
          poemId: "poem-test-1",
          orderIndex: 1,
          text: "هَل غادَرَ الشُعَراءُ مِن مُتَرَدَّمِ ... أَم هَل عَرَفتَ الدارَ بَعدَ تَوَهُّمِ",
          normalizedText: normalizeArabic("هل غادر الشعراء من متردم ام هل عرفت الدار بعد توهم"),
          firstHemistich: "هَل غادَرَ الشُعَراءُ مِن مُتَرَدَّمِ",
          secondHemistich: "أَم هَل عَرَفتَ الدارَ بَعدَ تَوَهُّمِ",
          alignment: {
            id: "align-test-1",
            verseId: "v-test-1",
            recordingId: "rec-test-1",
            startMs: 1000,
            endMs: 7500,
            confidence: 0.94,
            status: "auto",
          },
        },
      ],
    };

    // 1. Create
    await repo.savePoem(poem);

    // 2. Read
    const fetched = await repo.getPoemById("poem-test-1");
    expect(fetched).not.toBeNull();
    expect(fetched?.title).toBe("هل غادر الشعراء من متردم");
    expect(fetched?.poet.name).toBe("عنترة بن شداد");
    expect(fetched?.verses.length).toBe(1);
    expect(fetched?.verses[0].alignment?.confidence).toBe(0.94);
    expect(fetched?.recordings.length).toBe(1);

    // 3. Update Alignment Boundary
    await repo.updateAlignmentBoundary("align-test-1", 1200, 7800, "reviewed", 0.98);
    const updatedPoem = await repo.getPoemById("poem-test-1");
    expect(updatedPoem?.verses[0].alignment?.startMs).toBe(1200);
    expect(updatedPoem?.verses[0].alignment?.endMs).toBe(7800);
    expect(updatedPoem?.verses[0].alignment?.status).toBe("reviewed");

    // 4. Delete
    await repo.deletePoem("poem-test-1");
    const deletedPoem = await repo.getPoemById("poem-test-1");
    expect(deletedPoem).toBeNull();
  });

  it("handles Word Definitions lookup", async () => {
    const def: WordDefinition = {
      id: "def-1",
      word: "مُتَرَدَّمِ",
      normalizedWord: normalizeArabic("متردم"),
      meaning: "الموضع الذي يحتاج إلى إصلاح وترقيع",
      source: "لسان العرب",
    };

    await repo.saveDefinition(def);
    const fetched = await repo.getDefinition(normalizeArabic("متردم"));
    expect(fetched).not.toBeNull();
    expect(fetched?.meaning).toBe("الموضع الذي يحتاج إلى إصلاح وترقيع");
    expect(fetched?.source).toBe("لسان العرب");
  });

  it("tracks Import Jobs lifecycle", async () => {
    const job: ImportJob = {
      id: "job-1",
      status: "pending",
      jobType: "audio_transcription",
      inputPath: "/tmp/sample.mp3",
      progress: 0.0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await repo.createImportJob(job);
    const fetched = await repo.getImportJob("job-1");
    expect(fetched?.status).toBe("pending");

    await repo.updateImportJobProgress("job-1", 0.55, "processing");
    const updated = await repo.getImportJob("job-1");
    expect(updated?.progress).toBe(0.55);
    expect(updated?.status).toBe("processing");
  });

  describe("segmentation corrections (merge_verses / split_verse)", () => {
    async function seedThreeVerseTestPoem(): Promise<Poem> {
      const poet: Poet = { id: "poet-seg", name: "شاعر الاختبار", era: "جاهلي" };
      const poem: Poem = {
        id: "poem-seg",
        title: "قصيدة اختبار التقسيم",
        poet,
        era: "جاهلي",
        bahr: "الطويل",
        rhyme: "الدال",
        versesCount: 3,
        tags: [],
        recordings: [
          {
            id: "rec-seg",
            poemId: "poem-seg",
            title: "تسجيل",
            reciter: "قارئ",
            audioPath: "recordings/seg.mp3",
            durationMs: 30000,
            createdAt: "2026-01-01",
          },
        ],
        verses: [
          {
            id: "v-seg-1",
            poemId: "poem-seg",
            orderIndex: 1,
            text: "الشطر الأول من البيت الأول",
            normalizedText: normalizeArabic("الشطر الأول من البيت الأول"),
            firstHemistich: "الشطر الأول",
            secondHemistich: "من البيت الأول",
            alignment: {
              id: "align-seg-1",
              verseId: "v-seg-1",
              recordingId: "rec-seg",
              startMs: 0,
              endMs: 5000,
              confidence: 0.9,
              status: "reviewed",
            },
          },
          // v-seg-2 and v-seg-3 together represent one over-split بيت — its
          // two halves were mistakenly stored as two separate verse rows.
          {
            id: "v-seg-2",
            poemId: "poem-seg",
            orderIndex: 2,
            text: "شطر أول لبيت وقع تقسيمه خطأ",
            normalizedText: normalizeArabic("شطر أول لبيت وقع تقسيمه خطأ"),
            firstHemistich: "شطر أول",
            secondHemistich: "لبيت وقع تقسيمه خطأ",
            alignment: {
              id: "align-seg-2",
              verseId: "v-seg-2",
              recordingId: "rec-seg",
              startMs: 5000,
              endMs: 9000,
              confidence: 0.8,
              status: "auto",
            },
          },
          {
            id: "v-seg-3",
            poemId: "poem-seg",
            orderIndex: 3,
            text: "شطر ثانٍ لنفس البيت المقسوم خطأ",
            normalizedText: normalizeArabic("شطر ثانٍ لنفس البيت المقسوم خطأ"),
            firstHemistich: "شطر ثانٍ",
            secondHemistich: "لنفس البيت المقسوم خطأ",
            alignment: {
              id: "align-seg-3",
              verseId: "v-seg-3",
              recordingId: "rec-seg",
              startMs: 9000,
              endMs: 13000,
              confidence: 0.8,
              status: "auto",
            },
          },
        ],
      };
      await repo.savePoem(poem);
      await repo.saveVerseExplanations("v-seg-2", [
        {
          id: "exp-seg-2",
          verseId: "v-seg-2",
          text: "شرح مرتبط بالشطر الأول من البيت المقسوم خطأ.",
          explanationType: "manual",
          provider: "manual_paste",
        },
      ]);
      await repo.saveVerseExplanations("v-seg-3", [
        {
          id: "exp-seg-3",
          verseId: "v-seg-3",
          text: "شرح مرتبط بالشطر الثاني من نفس البيت.",
          explanationType: "manual",
          provider: "manual_paste",
        },
      ]);
      return poem;
    }

    it("mergeVerses folds an over-split بيت back into one row without corrupting order or explanations", async () => {
      await seedThreeVerseTestPoem();

      await repo.mergeVerses(
        "poem-seg",
        "v-seg-2",
        "v-seg-3",
        "شطر أول لبيت وقع تقسيمه خطأ",
        "شطر ثانٍ لنفس البيت المقسوم خطأ"
      );

      const poem = await repo.getPoemById("poem-seg");
      expect(poem).not.toBeNull();
      expect(poem!.verses).toHaveLength(2);
      expect(poem!.versesCount).toBe(2);

      // order_index stays contiguous starting at 1, no gaps or duplicates.
      const orderIndices = poem!.verses.map((v) => v.orderIndex).sort((a, b) => a - b);
      expect(orderIndices).toEqual([1, 2]);
      expect(new Set(orderIndices).size).toBe(2);

      // The unaffected first verse is untouched.
      const untouched = poem!.verses.find((v) => v.id === "v-seg-1");
      expect(untouched?.firstHemistich).toBe("الشطر الأول");
      expect(untouched?.alignment?.id).toBe("align-seg-1");

      // The kept verse now holds the merged hemistichs and both explanations;
      // the removed verse must be fully gone (no orphaned row).
      const merged = poem!.verses.find((v) => v.id === "v-seg-2");
      expect(merged).toBeTruthy();
      expect(merged?.firstHemistich).toBe("شطر أول لبيت وقع تقسيمه خطأ");
      expect(merged?.secondHemistich).toBe("شطر ثانٍ لنفس البيت المقسوم خطأ");
      expect(poem!.verses.find((v) => v.id === "v-seg-3")).toBeUndefined();

      const mergedExplanations = merged?.explanations || [];
      expect(mergedExplanations.length).toBe(2);
      expect(mergedExplanations.some((e) => e.text.includes("الشطر الأول من البيت"))).toBe(true);
      expect(mergedExplanations.some((e) => e.text.includes("الشطر الثاني"))).toBe(true);

      // No leftover alignment or explanation rows reference the deleted verse.
      const orphanedAlignment = await repo.getAlignmentByVerseId("v-seg-3");
      expect(orphanedAlignment).toBeNull();
      const orphanedExplanations = await repo.getVerseExplanationsByVerseId("v-seg-3");
      expect(orphanedExplanations).toHaveLength(0);
    });

    it("splitVerse breaks an over-merged verse row into two contiguous verses", async () => {
      await seedThreeVerseTestPoem();

      const newVerseId = await repo.splitVerse(
        "poem-seg",
        "v-seg-2",
        { firstHemistich: "شطر أول", secondHemistich: "لبيت وقع تقسيمه خطأ" },
        { firstHemistich: "بيت مستقل تماماً", secondHemistich: "كان مدموجاً خطأ مع سابقه" }
      );

      const poem = await repo.getPoemById("poem-seg");
      expect(poem).not.toBeNull();
      expect(poem!.verses).toHaveLength(4);
      expect(poem!.versesCount).toBe(4);

      const orderIndices = poem!.verses.map((v) => v.orderIndex).sort((a, b) => a - b);
      expect(orderIndices).toEqual([1, 2, 3, 4]);
      expect(new Set(orderIndices).size).toBe(4);

      // The original verse keeps its id, order position, and alignment.
      const firstHalf = poem!.verses.find((v) => v.id === "v-seg-2");
      expect(firstHalf?.orderIndex).toBe(2);
      expect(firstHalf?.firstHemistich).toBe("شطر أول");
      expect(firstHalf?.alignment?.id).toBe("align-seg-2");
      // Explanations on the original verse stay attached to the first half.
      expect(firstHalf?.explanations?.some((e) => e.id === "exp-seg-2")).toBe(true);

      // The new verse is inserted immediately after, with no alignment yet
      // (needs re-review) and no explanations carried over.
      const secondHalf = poem!.verses.find((v) => v.id === newVerseId);
      expect(secondHalf).toBeTruthy();
      expect(secondHalf?.orderIndex).toBe(3);
      expect(secondHalf?.firstHemistich).toBe("بيت مستقل تماماً");
      expect(secondHalf?.secondHemistich).toBe("كان مدموجاً خطأ مع سابقه");
      expect(secondHalf?.alignment).toBeUndefined();
      expect(secondHalf?.explanations).toBeUndefined();

      // The verse that originally followed shifted up by exactly one slot,
      // keeping its own alignment intact.
      const shifted = poem!.verses.find((v) => v.id === "v-seg-3");
      expect(shifted?.orderIndex).toBe(4);
      expect(shifted?.alignment?.id).toBe("align-seg-3");
    });

    it("supports merge followed by split without corrupting order_index or losing data", async () => {
      await seedThreeVerseTestPoem();

      await repo.mergeVerses(
        "poem-seg",
        "v-seg-2",
        "v-seg-3",
        "شطر أول لبيت وقع تقسيمه خطأ",
        "شطر ثانٍ لنفس البيت المقسوم خطأ"
      );
      const afterMerge = await repo.getVersesByPoemId("poem-seg");
      expect(afterMerge).toHaveLength(2);

      const newId = await repo.splitVerse(
        "poem-seg",
        "v-seg-1",
        { firstHemistich: "الشطر الأول", secondHemistich: "من البيت الأول" },
        { firstHemistich: "شطر جديد بعد الانقسام", secondHemistich: "لبيت لم يكن موجوداً" }
      );

      const finalVerses = await repo.getVersesByPoemId("poem-seg");
      expect(finalVerses).toHaveLength(3);
      const orderIndices = finalVerses.map((v) => v.orderIndex).sort((a, b) => a - b);
      expect(orderIndices).toEqual([1, 2, 3]);
      expect(new Set(finalVerses.map((v) => v.id)).size).toBe(3);
      expect(finalVerses.find((v) => v.id === newId)?.orderIndex).toBe(2);
      expect(finalVerses.find((v) => v.id === "v-seg-2")?.orderIndex).toBe(3);

      const poem = await repo.getPoemById("poem-seg");
      expect(poem?.versesCount).toBe(3);
    });
  });
});
