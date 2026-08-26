import { describe, it, expect, beforeEach } from "vitest";
import { DiwanRepository } from "./repository";
import { BetterSqliteAdapter } from "./adapter";
import { Poet, Poem, WordDefinition, ImportJob } from "@/types";
import { normalizeArabic } from "@/lib/utils";

describe("Diwan SQLite Repository", () => {
  let adapter: BetterSqliteAdapter;
  let repo: DiwanRepository;

  beforeEach(async () => {
    adapter = new BetterSqliteAdapter(":memory:");
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
});
