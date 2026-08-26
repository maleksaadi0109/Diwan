import {
  Poem,
  Poet,
  Verse,
  Recording,
  VerseAlignment,
  WordDefinition,
  MeterAnalysis,
  ImportJob,
  Era,
  Bahr,
  AlignmentStatus,
} from "@/types";
import { normalizeArabic } from "@/lib/utils";
import { DatabaseAdapter, getDatabase } from "./adapter";
import {
  INITIAL_SCHEMA_SQL,
  PoetRow,
  PoemRow,
  VerseRow,
  RecordingRow,
  VerseAlignmentRow,
  WordDefinitionRow,
  MeterAnalysisRow,
  ImportJobRow,
} from "./schema";
import { MOCK_POEMS, MOCK_POETS } from "@/data/mockData";

export class DiwanRepository {
  private adapter: DatabaseAdapter;

  constructor(adapter: DatabaseAdapter) {
    this.adapter = adapter;
  }

  static async create(customAdapter?: DatabaseAdapter): Promise<DiwanRepository> {
    const db = customAdapter || (await getDatabase());
    const repo = new DiwanRepository(db);
    await repo.init();
    return repo;
  }

  async init(): Promise<void> {
    await this.adapter.execute(INITIAL_SCHEMA_SQL);
  }

  // --- Seeding ---
  async seed(): Promise<void> {
    // Seed Poets
    for (const poet of Object.values(MOCK_POETS)) {
      await this.savePoet(poet);
    }

    // Seed Poems with Verses, Recordings, and Alignments
    for (const poem of MOCK_POEMS) {
      await this.savePoem(poem);
    }
  }

  // --- Poet Methods ---
  async savePoet(poet: Poet): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO poets (id, name, era, bio, birth_year, death_year)
      VALUES (?, ?, ?, ?, ?, ?);
    `;
    await this.adapter.execute(sql, [
      poet.id,
      poet.name,
      poet.era,
      poet.bio || null,
      poet.birthYear || null,
      poet.deathYear || null,
    ]);
  }

  async getPoetById(id: string): Promise<Poet | null> {
    const rows = await this.adapter.select<PoetRow>(
      `SELECT * FROM poets WHERE id = ? LIMIT 1;`,
      [id]
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      name: r.name,
      era: r.era as Era,
      bio: r.bio || undefined,
      birthYear: r.birth_year || undefined,
      deathYear: r.death_year || undefined,
    };
  }

  async getAllPoets(): Promise<Poet[]> {
    const rows = await this.adapter.select<PoetRow>(`SELECT * FROM poets ORDER BY name ASC;`);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      era: r.era as Era,
      bio: r.bio || undefined,
      birthYear: r.birth_year || undefined,
      deathYear: r.death_year || undefined,
    }));
  }

  // --- Poem Methods ---
  async savePoem(poem: Poem): Promise<void> {
    // Ensure poet is saved
    await this.savePoet(poem.poet);

    const sql = `
      INSERT OR REPLACE INTO poems (id, title, poet_id, era, bahr, rhyme, description, verses_count, tags, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
    `;
    await this.adapter.execute(sql, [
      poem.id,
      poem.title,
      poem.poet.id,
      poem.era,
      poem.bahr,
      poem.rhyme,
      poem.description || null,
      poem.versesCount,
      JSON.stringify(poem.tags || []),
    ]);

    // Save recordings
    for (const rec of poem.recordings) {
      await this.saveRecording(rec);
    }

    // Save verses and their alignments
    for (const verse of poem.verses) {
      await this.saveVerse(verse);
      if (verse.alignment) {
        await this.saveAlignment(verse.alignment);
      }
    }
  }

  async getPoemById(id: string): Promise<Poem | null> {
    const rows = await this.adapter.select<PoemRow>(
      `SELECT * FROM poems WHERE id = ? LIMIT 1;`,
      [id]
    );
    if (rows.length === 0) return null;
    const r = rows[0];

    const poet = await this.getPoetById(r.poet_id);
    if (!poet) return null;

    const verses = await this.getVersesByPoemId(r.id);
    const recordings = await this.getRecordingsByPoemId(r.id);

    return {
      id: r.id,
      title: r.title,
      poet,
      era: r.era as Era,
      bahr: r.bahr as Bahr,
      rhyme: r.rhyme,
      description: r.description || undefined,
      versesCount: r.verses_count,
      tags: typeof r.tags === "string" ? JSON.parse(r.tags) : r.tags || [],
      verses,
      recordings,
      defaultRecordingId: recordings[0]?.id,
    };
  }

  async getAllPoems(): Promise<Poem[]> {
    const rows = await this.adapter.select<PoemRow>(
      `SELECT * FROM poems ORDER BY created_at DESC;`
    );

    const poems: Poem[] = [];
    for (const r of rows) {
      const poet = await this.getPoetById(r.poet_id);
      if (!poet) continue;

      const verses = await this.getVersesByPoemId(r.id);
      const recordings = await this.getRecordingsByPoemId(r.id);

      poems.push({
        id: r.id,
        title: r.title,
        poet,
        era: r.era as Era,
        bahr: r.bahr as Bahr,
        rhyme: r.rhyme,
        description: r.description || undefined,
        versesCount: r.verses_count,
        tags: typeof r.tags === "string" ? JSON.parse(r.tags) : r.tags || [],
        verses,
        recordings,
        defaultRecordingId: recordings[0]?.id,
      });
    }

    return poems;
  }

  async deletePoem(id: string): Promise<void> {
    await this.adapter.execute(`DELETE FROM poems WHERE id = ?;`, [id]);
  }

  // --- Verse Methods ---
  async saveVerse(verse: Verse): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO verses (id, poem_id, order_index, text, normalized_text, first_hemistich, second_hemistich, explanation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `;
    await this.adapter.execute(sql, [
      verse.id,
      verse.poemId,
      verse.orderIndex,
      verse.text,
      verse.normalizedText,
      verse.firstHemistich,
      verse.secondHemistich,
      verse.explanation || null,
    ]);
  }

  async getVersesByPoemId(poemId: string): Promise<Verse[]> {
    const rows = await this.adapter.select<VerseRow>(
      `SELECT * FROM verses WHERE poem_id = ? ORDER BY order_index ASC;`,
      [poemId]
    );

    const verses: Verse[] = [];
    for (const r of rows) {
      const alignRows = await this.adapter.select<VerseAlignmentRow>(
        `SELECT * FROM verse_alignments WHERE verse_id = ? LIMIT 1;`,
        [r.id]
      );

      let alignment: VerseAlignment | undefined = undefined;
      if (alignRows.length > 0) {
        const a = alignRows[0];
        alignment = {
          id: a.id,
          verseId: a.verse_id,
          recordingId: a.recording_id,
          startMs: a.start_ms,
          endMs: a.end_ms,
          confidence: a.confidence,
          status: a.status as 'auto' | 'reviewed' | 'manual',
          transcriptRange: a.start_token_index !== null ? {
            startTokenIndex: a.start_token_index,
            endTokenIndex: a.end_token_index ?? a.start_token_index,
          } : undefined,
        };
      }

      verses.push({
        id: r.id,
        poemId: r.poem_id,
        orderIndex: r.order_index,
        text: r.text,
        normalizedText: r.normalized_text,
        firstHemistich: r.first_hemistich,
        secondHemistich: r.second_hemistich,
        explanation: r.explanation || undefined,
        alignment,
      });
    }

    return verses;
  }

  // --- Recording Methods ---
  async saveRecording(rec: Recording): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO recordings (id, poem_id, title, reciter, audio_path, duration_ms, sample_rate, channels, format)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    await this.adapter.execute(sql, [
      rec.id,
      rec.poemId,
      rec.title,
      rec.reciter,
      rec.audioPath,
      rec.durationMs,
      rec.sampleRate || null,
      rec.channels || null,
      rec.format || null,
    ]);
  }

  async getRecordingsByPoemId(poemId: string): Promise<Recording[]> {
    const rows = await this.adapter.select<RecordingRow>(
      `SELECT * FROM recordings WHERE poem_id = ? ORDER BY created_at ASC;`,
      [poemId]
    );
    return rows.map((r) => ({
      id: r.id,
      poemId: r.poem_id,
      title: r.title,
      reciter: r.reciter,
      audioPath: r.audio_path,
      durationMs: r.duration_ms,
      sampleRate: r.sample_rate || undefined,
      channels: r.channels || undefined,
      format: r.format || undefined,
      createdAt: r.created_at,
    }));
  }

  // --- Alignment Methods ---
  async saveAlignment(align: VerseAlignment): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO verse_alignments (id, verse_id, recording_id, start_ms, end_ms, confidence, status, start_token_index, end_token_index, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
    `;
    await this.adapter.execute(sql, [
      align.id,
      align.verseId,
      align.recordingId,
      align.startMs,
      align.endMs,
      align.confidence,
      align.status,
      align.transcriptRange?.startTokenIndex ?? null,
      align.transcriptRange?.endTokenIndex ?? null,
    ]);
  }

  async updateAlignmentBoundary(
    id: string,
    startMs: number,
    endMs: number,
    status: AlignmentStatus = 'reviewed',
    confidence = 1.0
  ): Promise<void> {
    const sql = `
      UPDATE verse_alignments
      SET start_ms = ?, end_ms = ?, status = ?, confidence = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?;
    `;
    await this.adapter.execute(sql, [startMs, endMs, status, confidence, id]);
  }

  // --- Word Definitions ---
  async saveDefinition(def: WordDefinition): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO word_definitions (id, word, normalized_word, root, meaning, source)
      VALUES (?, ?, ?, ?, ?, ?);
    `;
    await this.adapter.execute(sql, [
      def.id,
      def.word,
      def.normalizedWord,
      def.root || null,
      def.meaning,
      def.source,
    ]);
  }

  async getDefinition(normalizedWord: string): Promise<WordDefinition | null> {
    const rows = await this.adapter.select<WordDefinitionRow>(
      `SELECT * FROM word_definitions WHERE normalized_word = ? OR word = ? LIMIT 1;`,
      [normalizedWord, normalizedWord]
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      word: r.word,
      normalizedWord: r.normalized_word,
      root: r.root || undefined,
      meaning: r.meaning,
      source: r.source,
    };
  }

  async getWordDefinition(word: string): Promise<WordDefinition | null> {
    const normalized = normalizeArabic(word);
    return this.getDefinition(normalized);
  }

  // --- Meter Analyses ---
  async saveMeterAnalysis(
    analysis: MeterAnalysis,
    poemId: string,
    verseId?: string
  ): Promise<void> {
    const id = `meter-${poemId}${verseId ? `-${verseId}` : ""}`;
    const sql = `
      INSERT OR REPLACE INTO meter_analyses (id, poem_id, verse_id, bahr, pattern, tafeela_breakdown)
      VALUES (?, ?, ?, ?, ?, ?);
    `;
    await this.adapter.execute(sql, [
      id,
      poemId,
      verseId || null,
      analysis.bahr,
      analysis.pattern,
      JSON.stringify(analysis.tafeelaBreakdown),
    ]);
  }

  async getMeterAnalysis(poemId: string, verseId?: string): Promise<MeterAnalysis | null> {
    const sql = verseId
      ? `SELECT * FROM meter_analyses WHERE poem_id = ? AND verse_id = ? LIMIT 1;`
      : `SELECT * FROM meter_analyses WHERE poem_id = ? AND verse_id IS NULL LIMIT 1;`;
    const params = verseId ? [poemId, verseId] : [poemId];
    const rows = await this.adapter.select<MeterAnalysisRow>(sql, params);
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      bahr: r.bahr as Bahr,
      pattern: r.pattern,
      tafeelaBreakdown: typeof r.tafeela_breakdown === "string" ? JSON.parse(r.tafeela_breakdown) : r.tafeela_breakdown || [],
    };
  }

  // --- Import Jobs ---
  async createImportJob(job: ImportJob): Promise<void> {
    const sql = `
      INSERT INTO import_jobs (id, status, job_type, input_path, output_path, progress, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `;
    await this.adapter.execute(sql, [
      job.id,
      job.status,
      job.jobType,
      job.inputPath || null,
      job.outputPath || null,
      job.progress,
      job.errorMessage || null,
    ]);
  }

  async updateImportJobProgress(
    id: string,
    progress: number,
    status: ImportJob['status'],
    errorMessage?: string
  ): Promise<void> {
    const sql = `
      UPDATE import_jobs
      SET progress = ?, status = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?;
    `;
    await this.adapter.execute(sql, [progress, status, errorMessage || null, id]);
  }

  async getImportJob(id: string): Promise<ImportJob | null> {
    const rows = await this.adapter.select<ImportJobRow>(
      `SELECT * FROM import_jobs WHERE id = ? LIMIT 1;`,
      [id]
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      status: r.status as ImportJob['status'],
      jobType: r.job_type as ImportJob['jobType'],
      inputPath: r.input_path || undefined,
      outputPath: r.output_path || undefined,
      progress: r.progress,
      errorMessage: r.error_message || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}
