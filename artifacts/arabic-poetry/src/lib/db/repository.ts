import {
  Poem,
  Poet,
  Verse,
  Recording,
  VerseAlignment,
  VerseExplanationItem,
  WordDefinition,
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
  VerseExplanationRow,
  RecordingRow,
  VerseAlignmentRow,
  WordDefinitionRow,
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
    try {
      await this.adapter.execute("ALTER TABLE poems ADD COLUMN default_recording_id TEXT;");
    } catch {
      // Existing databases already have this migration, or the adapter handles
      // schema creation without SQL column migrations.
    }
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

    // Check if poem already has existing verses with alignments to preserve
    const existingVerses = await this.getVersesByPoemId(poem.id);
    const existingAlignmentMap = new Map<string, VerseAlignment>();
    for (const ev of existingVerses) {
      if (ev.alignment) {
        existingAlignmentMap.set(`${ev.id}:${ev.alignment.recordingId}`, ev.alignment);
      }
    }

    const sql = `
      INSERT OR REPLACE INTO poems (
        id, title, poet_id, era, bahr, rhyme, description, verses_count, tags,
        default_recording_id, external_provider, external_id, source_url, theme, verified, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
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
      poem.defaultRecordingId || poem.recordings[0]?.id || null,
      poem.externalProvider || null,
      poem.externalId || null,
      poem.sourceUrl || null,
      poem.theme || null,
      poem.verified ? 1 : 0,
    ]);

    // Save recordings
    for (const rec of poem.recordings) {
      await this.saveRecording(rec);
    }

    // Save verses and their alignments (preserving existing reviewed/manual alignments)
    for (const verse of poem.verses) {
      await this.saveVerse(verse);

      // If new verse has alignment, save it. Otherwise preserve only an alignment
      // belonging to the same verse and recording; order alone is unsafe after edits.
      if (verse.alignment) {
        await this.saveAlignment(verse.alignment);
      } else {
        const previous = existingVerses.find((existing) => existing.id === verse.id);
        const preserved = previous?.alignment
          ? existingAlignmentMap.get(`${previous.id}:${previous.alignment.recordingId}`)
          : undefined;
        if (!preserved) continue;
        await this.saveAlignment({
          ...preserved,
          verseId: verse.id,
        });
      }

      if (verse.explanations && verse.explanations.length > 0) {
        await this.saveVerseExplanations(verse.id, verse.explanations);
      }
    }
  }

  async getPoemById(id: string): Promise<Poem | null> {
    const rows = await this.adapter.select<PoemRow>(
      `SELECT * FROM poems WHERE id = ? LIMIT 1;`,
      [id]
    );
    if (rows.length === 0) return null;
    return this.mapPoemRow(rows[0]);
  }

  async getPoemByExternalId(provider: string, externalId: string): Promise<Poem | null> {
    const rows = await this.adapter.select<PoemRow>(
      `SELECT * FROM poems WHERE external_provider = ? AND external_id = ? LIMIT 1;`,
      [provider, externalId]
    );
    if (rows.length === 0) return null;
    return this.mapPoemRow(rows[0]);
  }

  private async mapPoemRow(r: PoemRow): Promise<Poem | null> {
    const poet = await this.getPoetById(r.poet_id);
    if (!poet) return null;

    const recordings = await this.getRecordingsByPoemId(r.id);
    const defaultRecordingId = recordings.some((recording) => recording.id === r.default_recording_id)
      ? r.default_recording_id || undefined
      : recordings[0]?.id;
    const verses = await this.getVersesByPoemId(r.id, defaultRecordingId);

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
      externalProvider: r.external_provider || undefined,
      externalId: r.external_id || undefined,
      sourceUrl: r.source_url || undefined,
      theme: r.theme || undefined,
      verified: r.verified === 1,
      verses,
      recordings,
      defaultRecordingId,
    };
  }

  async getAllPoems(): Promise<Poem[]> {
    const rows = await this.adapter.select<PoemRow>(
      `SELECT * FROM poems ORDER BY created_at DESC;`
    );

    const poems: Poem[] = [];
    for (const r of rows) {
      const p = await this.mapPoemRow(r);
      if (p) poems.push(p);
    }

    return poems;
  }

  async deletePoem(id: string): Promise<void> {
    await this.adapter.execute(
      `DELETE FROM verse_alignments WHERE verse_id IN (SELECT id FROM verses WHERE poem_id = ?);`,
      [id]
    );
    await this.adapter.execute(
      `DELETE FROM verse_explanations WHERE verse_id IN (SELECT id FROM verses WHERE poem_id = ?);`,
      [id]
    );
    await this.adapter.execute(`DELETE FROM verses WHERE poem_id = ?;`, [id]);
    await this.adapter.execute(`DELETE FROM recordings WHERE poem_id = ?;`, [id]);
    await this.adapter.execute(`DELETE FROM poems WHERE id = ?;`, [id]);
  }

  // --- Verse Methods ---
  async saveVerse(verse: Verse): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO verses (
        id, poem_id, order_index, text, normalized_text, first_hemistich, second_hemistich, explanation, external_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    await this.adapter.execute(sql, [
      verse.id,
      verse.poemId,
      verse.orderIndex,
      verse.text,
      verse.normalizedText || normalizeArabic(verse.text),
      verse.firstHemistich,
      verse.secondHemistich,
      verse.explanation || null,
      verse.externalId || null,
    ]);
  }

  async getVersesByPoemId(poemId: string, recordingId?: string): Promise<Verse[]> {
    const rows = await this.adapter.select<VerseRow>(
      `SELECT * FROM verses WHERE poem_id = ? ORDER BY order_index ASC;`,
      [poemId]
    );

    const verses: Verse[] = [];
    for (const r of rows) {
      const alignment = await this.getAlignmentByVerseId(r.id, recordingId);
      const explanations = await this.getVerseExplanationsByVerseId(r.id);

      verses.push({
        id: r.id,
        poemId: r.poem_id,
        orderIndex: r.order_index,
        text: r.text,
        normalizedText: r.normalized_text,
        firstHemistich: r.first_hemistich,
        secondHemistich: r.second_hemistich,
        explanation: r.explanation || undefined,
        externalId: r.external_id || undefined,
        alignment: alignment || undefined,
        explanations: explanations.length > 0 ? explanations : undefined,
      });
    }

    return verses;
  }

  // --- Explanations Methods ---
  async saveVerseExplanations(verseId: string, explanations: VerseExplanationItem[]): Promise<void> {
    for (const exp of explanations) {
      const sql = `
        INSERT OR REPLACE INTO verse_explanations (
          id, verse_id, verse_external_id, text, author, author_death_hijri, source_title,
          explanation_type, provider, raw_source_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `;
      await this.adapter.execute(sql, [
        exp.id,
        verseId,
        exp.verseExternalId || null,
        exp.text,
        exp.author || null,
        exp.authorDeathHijri || null,
        exp.sourceTitle || null,
        exp.explanationType,
        exp.provider,
        exp.rawSourceJson || null,
      ]);
    }
  }

  async getVerseExplanationsByVerseId(verseId: string): Promise<VerseExplanationItem[]> {
    const rows = await this.adapter.select<VerseExplanationRow>(
      `SELECT * FROM verse_explanations WHERE verse_id = ? ORDER BY created_at ASC;`,
      [verseId]
    );

    return rows.map((r) => ({
      id: r.id,
      verseId: r.verse_id,
      verseExternalId: r.verse_external_id || undefined,
      text: r.text,
      author: r.author || undefined,
      authorDeathHijri: r.author_death_hijri || undefined,
      sourceTitle: r.source_title || undefined,
      explanationType: r.explanation_type as "classical" | "verse" | "manual",
      provider: r.provider,
      rawSourceJson: r.raw_source_json || undefined,
      createdAt: r.created_at,
    }));
  }

  // --- Recording Methods ---
  async saveRecording(recording: Recording): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO recordings (id, poem_id, title, reciter, audio_path, duration_ms, sample_rate, channels, format)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    await this.adapter.execute(sql, [
      recording.id,
      recording.poemId,
      recording.title,
      recording.reciter,
      recording.audioPath,
      recording.durationMs,
      recording.sampleRate || null,
      recording.channels || null,
      recording.format || null,
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

  async saveAlignment(alignment: VerseAlignment): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO verse_alignments (
        id, verse_id, recording_id, start_ms, end_ms, confidence, status, start_token_index, end_token_index, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
    `;
    await this.adapter.execute(sql, [
      alignment.id,
      alignment.verseId,
      alignment.recordingId,
      alignment.startMs,
      alignment.endMs,
      alignment.confidence,
      alignment.status,
      alignment.transcriptRange?.startTokenIndex || null,
      alignment.transcriptRange?.endTokenIndex || null,
    ]);
  }

  async updateAlignmentBoundary(
    alignmentId: string,
    startMs: number,
    endMs: number,
    status: AlignmentStatus = "reviewed",
    confidence?: number
  ): Promise<void> {
    const sql = `
      UPDATE verse_alignments
      SET start_ms = ?, end_ms = ?, status = ?, confidence = COALESCE(?, confidence), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?;
    `;
    await this.adapter.execute(sql, [startMs, endMs, status, confidence ?? null, alignmentId]);
  }

  async getAlignmentByVerseId(verseId: string, recordingId?: string): Promise<VerseAlignment | null> {
    const rows = recordingId
      ? await this.adapter.select<VerseAlignmentRow>(
          `SELECT * FROM verse_alignments WHERE verse_id = ? AND recording_id = ? LIMIT 1;`,
          [verseId, recordingId]
        )
      : await this.adapter.select<VerseAlignmentRow>(
          `SELECT * FROM verse_alignments WHERE verse_id = ? ORDER BY CASE status WHEN 'manual' THEN 0 WHEN 'reviewed' THEN 1 ELSE 2 END LIMIT 1;`,
          [verseId]
        );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      verseId: r.verse_id,
      recordingId: r.recording_id,
      startMs: r.start_ms,
      endMs: r.end_ms,
      confidence: r.confidence,
      status: r.status as AlignmentStatus,
      transcriptRange:
        r.start_token_index !== null && r.end_token_index !== null
          ? {
              startTokenIndex: r.start_token_index,
              endTokenIndex: r.end_token_index,
            }
          : undefined,
    };
  }

  // --- Word Definition (Dictionary) ---
  async saveWordDefinition(def: WordDefinition): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO word_definitions (id, word, normalized_word, root, meaning, source)
      VALUES (?, ?, ?, ?, ?, ?);
    `;
    await this.adapter.execute(sql, [
      def.id,
      def.word,
      def.normalizedWord || normalizeArabic(def.word),
      def.root || null,
      def.meaning,
      def.source,
    ]);
  }

  async saveDefinition(def: WordDefinition): Promise<void> {
    return this.saveWordDefinition(def);
  }

  async getWordDefinition(word: string): Promise<WordDefinition | null> {
    const norm = normalizeArabic(word);
    const rows = await this.adapter.select<WordDefinitionRow>(
      `SELECT * FROM word_definitions WHERE normalized_word = ? OR word = ? LIMIT 1;`,
      [norm, word]
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

  async getDefinition(word: string): Promise<WordDefinition | null> {
    return this.getWordDefinition(word);
  }

  // --- Import Job Tracking ---
  async saveImportJob(job: ImportJob): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO import_jobs (id, status, job_type, input_path, output_path, progress, error_message, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
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

  async createImportJob(job: ImportJob): Promise<void> {
    return this.saveImportJob(job);
  }

  async getImportJobById(id: string): Promise<ImportJob | null> {
    const rows = await this.adapter.select<ImportJobRow>(
      `SELECT * FROM import_jobs WHERE id = ? LIMIT 1;`,
      [id]
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      status: r.status as ImportJob["status"],
      jobType: r.job_type as ImportJob["jobType"],
      inputPath: r.input_path || undefined,
      outputPath: r.output_path || undefined,
      progress: r.progress,
      errorMessage: r.error_message || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  async getImportJob(id: string): Promise<ImportJob | null> {
    return this.getImportJobById(id);
  }

  async updateImportJobProgress(
    id: string,
    progress: number,
    status?: ImportJob["status"],
    error?: string
  ): Promise<void> {
    const existing = await this.getImportJobById(id);
    if (!existing) return;
    await this.saveImportJob({
      ...existing,
      progress,
      status: status || existing.status,
      errorMessage: error !== undefined ? error : existing.errorMessage,
    });
  }
}
