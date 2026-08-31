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

  it("seeds database idempotently without default poems", async () => {
    await repo.seed();
    const count = (await repo.getAllPoems()).length;
    expect(count).toBe(0);

    const poets = await repo.getAllPoets();
    expect(poets.length).toBeGreaterThan(0);

    // Re-running seed must not throw and must keep same state
    await repo.seed();
    const secondCount = (await repo.getAllPoems()).length;
    expect(secondCount).toBe(0);
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
      title: "استيراد تجريبي",
      stage: "queued",
      stageLabel: "بانتظار المعالجة",
      inputPath: "/tmp/sample.mp3",
      progress: 0.0,
      retryCount: 0,
      maxRetries: 3,
      cancelRequested: false,
      payload: "{}",
      notified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await repo.createImportJob(job);
    const fetched = await repo.getImportJob("job-1");
    expect(fetched?.status).toBe("pending");
    expect(fetched?.title).toBe("استيراد تجريبي");

    await repo.updateImportJobProgress("job-1", 0.55, "processing");
    const updated = await repo.getImportJob("job-1");
    expect(updated?.progress).toBe(0.55);
    expect(updated?.status).toBe("processing");

    // created_at must survive an update-in-place (regression: an earlier
    // INSERT OR REPLACE omitted created_at from its column list, silently
    // resetting job creation timestamps on every save).
    expect(updated?.createdAt).toBe(job.createdAt);

    // List all jobs
    const all = await repo.getAllImportJobs();
    expect(all.some((j) => j.id === "job-1")).toBe(true);

    // Patch arbitrary fields
    await repo.patchImportJob("job-1", { stage: "download", stageLabel: "تنزيل الصوت", progress: 0.2 });
    const patched = await repo.getImportJobById("job-1");
    expect(patched?.stage).toBe("download");
    expect(patched?.progress).toBe(0.2);

    // Cooperative cancellation flag
    await repo.requestCancelImportJob("job-1");
    const cancelRequested = await repo.getImportJobById("job-1");
    expect(cancelRequested?.cancelRequested).toBe(true);

    // Delete
    await repo.deleteImportJob("job-1");
    const deleted = await repo.getImportJobById("job-1");
    expect(deleted).toBeNull();
  });

  describe("undo/redo snapshot restoration (snapshotPoemVerses / replacePoemVerses)", () => {
    it("preserves alignments across every recording, not just the default one, through a delete-then-undo cycle", async () => {
      const poet: Poet = { id: "poet-multi-rec", name: "شاعر متعدد التسجيلات", era: "أموي" };
      const poem: Poem = {
        id: "poem-multi-rec",
        title: "قصيدة بتسجيلين",
        poet,
        era: "أموي",
        bahr: "الطويل",
        rhyme: "اللام",
        versesCount: 2,
        tags: [],
        recordings: [
          {
            id: "rec-a",
            poemId: "poem-multi-rec",
            title: "التسجيل الافتراضي",
            reciter: "قارئ أ",
            audioPath: "recordings/a.mp3",
            durationMs: 20000,
            createdAt: "2026-01-01",
          },
          {
            id: "rec-b",
            poemId: "poem-multi-rec",
            title: "تسجيل ثانٍ",
            reciter: "قارئ ب",
            audioPath: "recordings/b.mp3",
            durationMs: 22000,
            createdAt: "2026-01-02",
          },
        ],
        defaultRecordingId: "rec-a",
        verses: [
          {
            id: "v-multi-1",
            poemId: "poem-multi-rec",
            orderIndex: 1,
            text: "بيت أول في القصيدة",
            normalizedText: normalizeArabic("بيت أول في القصيدة"),
            firstHemistich: "بيت أول",
            secondHemistich: "في القصيدة",
          },
          {
            id: "v-multi-2",
            poemId: "poem-multi-rec",
            orderIndex: 2,
            text: "بيت ثانٍ سيُحذف",
            normalizedText: normalizeArabic("بيت ثان سيحذف"),
            firstHemistich: "بيت ثانٍ",
            secondHemistich: "سيُحذف",
          },
        ],
      };
      await repo.savePoem(poem);
      // Each verse has an alignment against *both* recordings -- getPoemById
      // only surfaces the default recording's alignment via `Verse.alignment`,
      // but the non-default one must still be preserved by undo/redo.
      await repo.saveAlignment({ id: "align-1-a", verseId: "v-multi-1", recordingId: "rec-a", startMs: 0, endMs: 4000, confidence: 0.9, status: "reviewed" });
      await repo.saveAlignment({ id: "align-1-b", verseId: "v-multi-1", recordingId: "rec-b", startMs: 0, endMs: 4200, confidence: 0.85, status: "auto" });
      await repo.saveAlignment({ id: "align-2-a", verseId: "v-multi-2", recordingId: "rec-a", startMs: 4000, endMs: 8000, confidence: 0.9, status: "reviewed" });
      await repo.saveAlignment({ id: "align-2-b", verseId: "v-multi-2", recordingId: "rec-b", startMs: 4200, endMs: 8500, confidence: 0.85, status: "auto" });

      // Sanity check: the default-recording view only sees one alignment per verse.
      const before = await repo.getPoemById("poem-multi-rec");
      expect(before?.verses.find((v) => v.id === "v-multi-1")?.alignment?.id).toBe("align-1-a");

      const snapshot = await repo.snapshotPoemVerses("poem-multi-rec");
      expect(snapshot.find((v) => v.id === "v-multi-1")?.alignments).toHaveLength(2);
      expect(snapshot.find((v) => v.id === "v-multi-2")?.alignments).toHaveLength(2);

      // Simulate the undo/redo flow: delete a verse, then restore the snapshot.
      await repo.deleteVerse("poem-multi-rec", "v-multi-2");
      const afterDelete = await repo.getVersesByPoemId("poem-multi-rec");
      expect(afterDelete).toHaveLength(1);

      await repo.replacePoemVerses("poem-multi-rec", snapshot);

      const restored = await repo.getVersesByPoemId("poem-multi-rec");
      expect(restored).toHaveLength(2);

      // Both recordings' alignments for both verses must have survived the
      // round trip -- this is the regression the reviewer flagged: a naive
      // restore that only knew about the default-recording alignment would
      // silently drop rec-b's timing data here.
      const alignmentsV1 = await repo.getAlignmentsByVerseId("v-multi-1");
      const alignmentsV2 = await repo.getAlignmentsByVerseId("v-multi-2");
      expect(alignmentsV1.map((a) => a.id).sort()).toEqual(["align-1-a", "align-1-b"]);
      expect(alignmentsV2.map((a) => a.id).sort()).toEqual(["align-2-a", "align-2-b"]);
      expect(alignmentsV1.find((a) => a.recordingId === "rec-b")?.endMs).toBe(4200);
      expect(alignmentsV2.find((a) => a.recordingId === "rec-b")?.endMs).toBe(8500);
    });

    it("removes rows created after the snapshot (e.g. a split's new verse) when restoring an earlier snapshot", async () => {
      const poet: Poet = { id: "poet-prune", name: "شاعر الاختبار الثاني", era: "أموي" };
      const poem: Poem = {
        id: "poem-prune",
        title: "قصيدة اختبار الحذف الانتقائي",
        poet,
        era: "أموي",
        bahr: "الطويل",
        rhyme: "النون",
        versesCount: 1,
        tags: [],
        recordings: [],
        verses: [
          {
            id: "v-prune-1",
            poemId: "poem-prune",
            orderIndex: 1,
            text: "بيت واحد قبل التقسيم",
            normalizedText: normalizeArabic("بيت واحد قبل التقسيم"),
            firstHemistich: "بيت واحد",
            secondHemistich: "قبل التقسيم",
          },
        ],
      };
      await repo.savePoem(poem);

      const beforeSplit = await repo.snapshotPoemVerses("poem-prune");
      const newVerseId = await repo.splitVerse(
        "poem-prune",
        "v-prune-1",
        { firstHemistich: "بيت واحد", secondHemistich: "قبل التقسيم" },
        { firstHemistich: "بيت جديد", secondHemistich: "نتج عن التقسيم" }
      );
      expect((await repo.getVersesByPoemId("poem-prune")).map((v) => v.id).sort()).toEqual(
        ["v-prune-1", newVerseId].sort()
      );

      // Undo the split by restoring the pre-split snapshot -- the newly
      // created verse must be gone, not just orphaned.
      await repo.replacePoemVerses("poem-prune", beforeSplit);
      const restored = await repo.getVersesByPoemId("poem-prune");
      expect(restored.map((v) => v.id)).toEqual(["v-prune-1"]);

      const poemAfterUndo = await repo.getPoemById("poem-prune");
      expect(poemAfterUndo?.versesCount).toBe(1);
    });
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

    it("supports bulk deletion of multiple poems (deletePoems)", async () => {
      const poet: Poet = { id: "bulk-poet", name: "شاعر تجريبي", era: "عباسي" };
      await repo.savePoet(poet);

      const poem1: Poem = {
        id: "bulk-poem-1",
        title: "قصيدة تجريبية 1",
        poet,
        era: "عباسي",
        bahr: "البسيط",
        rhyme: "الميم",
        versesCount: 1,
        tags: [],
        recordings: [],
        verses: [
          {
            id: "bv-1",
            poemId: "bulk-poem-1",
            orderIndex: 1,
            text: "شطر أول ... شطر ثان",
            normalizedText: "شطر اول شطر ثان",
            firstHemistich: "شطر أول",
            secondHemistich: "شطر ثان",
          },
        ],
      };

      const poem2: Poem = {
        id: "bulk-poem-2",
        title: "قصيدة تجريبية 2",
        poet,
        era: "عباسي",
        bahr: "الطويل",
        rhyme: "الراء",
        versesCount: 1,
        tags: [],
        recordings: [],
        verses: [
          {
            id: "bv-2",
            poemId: "bulk-poem-2",
            orderIndex: 1,
            text: "صدر ... عجز",
            normalizedText: "صدر عجز",
            firstHemistich: "صدر",
            secondHemistich: "عجز",
          },
        ],
      };

      await repo.savePoem(poem1);
      await repo.savePoem(poem2);

      let all = await repo.getAllPoems();
      expect(all.map((p) => p.id)).toContain("bulk-poem-1");
      expect(all.map((p) => p.id)).toContain("bulk-poem-2");

      // Delete both poems in bulk
      await repo.deletePoems(["bulk-poem-1", "bulk-poem-2"]);

      all = await repo.getAllPoems();
      expect(all.map((p) => p.id)).not.toContain("bulk-poem-1");
      expect(all.map((p) => p.id)).not.toContain("bulk-poem-2");
    });

    it("supports deleting all poems from repository (deleteAllPoems)", async () => {
      const poet: Poet = { id: "all-poet", name: "شاعر", era: "جاهلي" };
      await repo.savePoet(poet);

      const poem: Poem = {
        id: "clear-poem-1",
        title: "قصيدة للمسح",
        poet,
        era: "جاهلي",
        bahr: "الوافر",
        rhyme: "النون",
        versesCount: 1,
        tags: [],
        recordings: [],
        verses: [
          {
            id: "cv-1",
            poemId: "clear-poem-1",
            orderIndex: 1,
            text: "بيت للمسح ... شطر ثان",
            normalizedText: "بيت للمسح شطر ثان",
            firstHemistich: "بيت للمسح",
            secondHemistich: "شطر ثان",
          },
        ],
      };

      await repo.savePoem(poem);
      expect((await repo.getAllPoems()).length).toBeGreaterThan(0);

      await repo.deleteAllPoems();
      expect(await repo.getAllPoems()).toHaveLength(0);
    });
  });

  describe("applyAlignmentBoundaryUpdates", () => {
    async function seedTwoVerseRecording(suffix: string) {
      const poetId = `poet-${suffix}`;
      const poemId = `poem-${suffix}`;
      const recordingId = `rec-${suffix}`;
      await repo.savePoet({ id: poetId, name: "شاعر", era: "عباسي" });
      await repo.savePoem({
        id: poemId,
        title: "قصيدة اختبار",
        poet: { id: poetId, name: "شاعر", era: "عباسي" },
        era: "عباسي",
        bahr: "البسيط",
        rhyme: "الميم",
        versesCount: 2,
        tags: [],
        recordings: [],
        verses: [],
      });
      await repo.saveVerse({
        id: `verse-a-${suffix}`,
        poemId,
        orderIndex: 1,
        text: "بيت أول",
        normalizedText: "بيت اول",
        firstHemistich: "شطر أول",
        secondHemistich: "شطر ثانٍ",
      });
      await repo.saveVerse({
        id: `verse-b-${suffix}`,
        poemId,
        orderIndex: 2,
        text: "بيت ثانٍ",
        normalizedText: "بيت ثان",
        firstHemistich: "شطر ثالث",
        secondHemistich: "شطر رابع",
      });
      await repo.saveRecording({
        id: recordingId,
        poemId,
        title: "تسجيل",
        reciter: "قارئ",
        audioPath: "/tmp/audio.mp3",
        durationMs: 10000,
      });
      return { verseAId: `verse-a-${suffix}`, verseBId: `verse-b-${suffix}`, recordingId };
    }

    it("writes every alignment in the batch when all updates succeed", async () => {
      const { verseAId, verseBId, recordingId } = await seedTwoVerseRecording("success");
      await repo.saveAlignment({
        id: "align-a",
        verseId: verseAId,
        recordingId,
        startMs: 0,
        endMs: 5000,
        confidence: 0.9,
        status: "auto",
      });
      await repo.saveAlignment({
        id: "align-b",
        verseId: verseBId,
        recordingId,
        startMs: 5000,
        endMs: 9000,
        confidence: 0.9,
        status: "auto",
      });

      await repo.applyAlignmentBoundaryUpdates([
        { alignmentId: "align-a", startMs: 0, endMs: 5500, status: "manual" },
        { alignmentId: "align-b", startMs: 5500, endMs: 9000, status: "manual" },
      ]);

      const a = await repo.getAlignmentByVerseId(verseAId);
      const b = await repo.getAlignmentByVerseId(verseBId);
      expect(a).toMatchObject({ endMs: 5500, status: "manual" });
      expect(b).toMatchObject({ startMs: 5500, status: "manual" });
    });

    it("rolls back the whole batch, via a real DB transaction, when a later update fails", async () => {
      const { verseAId: verseCId, verseBId: verseDId, recordingId } = await seedTwoVerseRecording("failure");
      await repo.saveAlignment({
        id: "align-c",
        verseId: verseCId,
        recordingId,
        startMs: 0,
        endMs: 4000,
        confidence: 0.8,
        status: "auto",
      });
      await repo.saveAlignment({
        id: "align-d",
        verseId: verseDId,
        recordingId,
        startMs: 4000,
        endMs: 8000,
        confidence: 0.8,
        status: "auto",
      });

      // Force the second write in the batch to fail. Because
      // applyAlignmentBoundaryUpdates runs the whole batch inside a real
      // adapter transaction, the first write -- already sent to the DB but
      // never committed -- must be discarded by the ROLLBACK, not left
      // behind by a best-effort compensating write.
      const originalUpdate = repo.updateAlignmentBoundary.bind(repo);
      let call = 0;
      repo.updateAlignmentBoundary = (async (...args: Parameters<typeof originalUpdate>) => {
        call += 1;
        if (call === 2) throw new Error("simulated write failure");
        return originalUpdate(...args);
      }) as typeof originalUpdate;

      await expect(
        repo.applyAlignmentBoundaryUpdates([
          { alignmentId: "align-c", startMs: 0, endMs: 4500, status: "manual" },
          { alignmentId: "align-d", startMs: 4500, endMs: 8000, status: "manual" },
        ])
      ).rejects.toThrow("simulated write failure");

      repo.updateAlignmentBoundary = originalUpdate;

      const c = await repo.getAlignmentByVerseId(verseCId);
      const d = await repo.getAlignmentByVerseId(verseDId);
      // Neither alignment's write survives -- the DB transaction was rolled
      // back as a whole, not compensated write-by-write.
      expect(c).toMatchObject({ endMs: 4000, status: "auto" });
      expect(d).toMatchObject({ startMs: 4000, status: "auto" });
    });

    it("discards the first write via a real ROLLBACK, not a second independent undo write that could itself fail", async () => {
      // Regression guard for the specific failure mode the previous
      // "compensating write" design had: this forces the *adapter's* raw
      // execute() to fail on the second UPDATE (not a mocked repository
      // method), proving the already-issued first UPDATE is undone by the
      // real SQL transaction's ROLLBACK rather than a second, independent
      // "undo" write that could itself fail and leave a mismatched
      // boundary behind.
      const { verseAId, verseBId, recordingId } = await seedTwoVerseRecording("rollback-guard");
      await repo.saveAlignment({
        id: "align-e",
        verseId: verseAId,
        recordingId,
        startMs: 0,
        endMs: 3000,
        confidence: 0.7,
        status: "auto",
      });
      await repo.saveAlignment({
        id: "align-f",
        verseId: verseBId,
        recordingId,
        startMs: 3000,
        endMs: 6000,
        confidence: 0.7,
        status: "auto",
      });

      const originalExecute = adapter.execute.bind(adapter);
      let updateCalls = 0;
      adapter.execute = (async (sql: string, params: unknown[] = []) => {
        if (sql.trim().startsWith("UPDATE verse_alignments")) {
          updateCalls += 1;
          if (updateCalls === 2) throw new Error("simulated adapter write failure");
        }
        return originalExecute(sql, params);
      }) as typeof originalExecute;

      await expect(
        repo.applyAlignmentBoundaryUpdates([
          { alignmentId: "align-e", startMs: 0, endMs: 3200, status: "manual" },
          { alignmentId: "align-f", startMs: 3200, endMs: 6000, status: "manual" },
        ])
      ).rejects.toThrow("simulated adapter write failure");

      adapter.execute = originalExecute;

      const e = await repo.getAlignmentByVerseId(verseAId);
      const f = await repo.getAlignmentByVerseId(verseBId);
      // The first UPDATE reached the DB (uncommitted) before the second
      // one failed; the transaction's ROLLBACK must have discarded it.
      expect(e).toMatchObject({ endMs: 3000, status: "auto" });
      expect(f).toMatchObject({ startMs: 3000, status: "auto" });
    });
  });
});
