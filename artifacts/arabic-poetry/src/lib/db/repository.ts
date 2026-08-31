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
  Playlist,
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
  PlaylistRow,
  PlaylistPoemRow,
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
    try {
      await this.adapter.execute("ALTER TABLE poems ADD COLUMN cover_image_url TEXT;");
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
      INSERT INTO poets (id, name, era, bio, birth_year, death_year)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        era = excluded.era,
        bio = excluded.bio,
        birth_year = excluded.birth_year,
        death_year = excluded.death_year;
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
      INSERT INTO poems (
        id, title, poet_id, era, bahr, rhyme, description, verses_count, tags,
        default_recording_id, external_provider, external_id, source_url, theme, verified,
        cover_image_url, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        poet_id = excluded.poet_id,
        era = excluded.era,
        bahr = excluded.bahr,
        rhyme = excluded.rhyme,
        description = excluded.description,
        verses_count = excluded.verses_count,
        tags = excluded.tags,
        default_recording_id = excluded.default_recording_id,
        external_provider = excluded.external_provider,
        external_id = excluded.external_id,
        source_url = excluded.source_url,
        theme = excluded.theme,
        verified = excluded.verified,
        cover_image_url = excluded.cover_image_url,
        updated_at = CURRENT_TIMESTAMP;
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
      poem.coverImageUrl || null,
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
      coverImageUrl: r.cover_image_url || undefined,
      verses,
      recordings,
      defaultRecordingId,
    };
  }

  async updatePoemCoverImage(poemId: string, coverImageUrl: string | null): Promise<void> {
    await this.adapter.execute(
      `UPDATE poems SET cover_image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
      [coverImageUrl, poemId]
    );
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
      `DELETE FROM playlist_poems WHERE poem_id = ?;`,
      [id]
    );
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

  async deletePoems(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.deletePoem(id);
    }
  }

  async deleteAllPoems(): Promise<void> {
    await this.adapter.execute(`DELETE FROM playlist_poems;`);
    await this.adapter.execute(`DELETE FROM verse_alignments;`);
    await this.adapter.execute(`DELETE FROM verse_explanations;`);
    await this.adapter.execute(`DELETE FROM verses;`);
    await this.adapter.execute(`DELETE FROM recordings;`);
    await this.adapter.execute(`DELETE FROM poems;`);
  }

  // --- Verse Methods ---
  async deleteVerse(poemId: string, verseId: string): Promise<void> {
    const rows = await this.adapter.select<VerseRow>(
      `SELECT * FROM verses WHERE poem_id = ? ORDER BY order_index ASC;`,
      [poemId]
    );
    const target = rows.find((r) => r.id === verseId);
    if (!target) {
      throw new Error("تعذر العثور على البيت المطلوب حذفه.");
    }

    await this.adapter.execute(`DELETE FROM verse_alignments WHERE verse_id = ?;`, [verseId]);
    await this.adapter.execute(`DELETE FROM verse_explanations WHERE verse_id = ?;`, [verseId]);
    await this.adapter.execute(`DELETE FROM verses WHERE id = ?;`, [verseId]);

    // Close the order_index gap left behind, processing from the smallest
    // affected order first so the UNIQUE(poem_id, order_index) constraint is
    // never briefly violated by two rows sharing the same value.
    const toShift = rows
      .filter((r) => r.order_index > target.order_index)
      .sort((a, b) => a.order_index - b.order_index);
    for (const row of toShift) {
      await this.adapter.execute(
        `UPDATE verses SET order_index = order_index - 1 WHERE id = ?;`,
        [row.id]
      );
    }

    await this.adapter.execute(
      `UPDATE poems SET verses_count = (SELECT COUNT(*) FROM verses WHERE poem_id = ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
      [poemId, poemId]
    );
  }

  async updateVerseText(verseId: string, firstHemistich: string, secondHemistich: string): Promise<void> {
    const text = `${firstHemistich} ${secondHemistich}`.trim();
    const normalizedText = normalizeArabic(text);
    await this.adapter.execute(
      `UPDATE verses SET text = ?, normalized_text = ?, first_hemistich = ?, second_hemistich = ? WHERE id = ?;`,
      [text, normalizedText, firstHemistich, secondHemistich, verseId]
    );
  }

  /**
   * Applies a "merge_verses" segmentation suggestion: folds `removeVerseId`
   * into `keepVerseId` (rewriting `keepVerseId`'s hemistichs to the merged
   * text), migrates any explanations attached to the removed verse onto the
   * kept one, then deletes the removed verse and closes the order_index gap.
   * `keepVerseId` must be the earlier verse in poem order.
   */
  async mergeVerses(
    poemId: string,
    keepVerseId: string,
    removeVerseId: string,
    firstHemistich: string,
    secondHemistich: string
  ): Promise<void> {
    await this.updateVerseText(keepVerseId, firstHemistich, secondHemistich);
    const removedExplanations = await this.getVerseExplanationsByVerseId(removeVerseId);
    if (removedExplanations.length > 0) {
      await this.saveVerseExplanations(
        keepVerseId,
        removedExplanations.map((exp) => ({ ...exp, id: `${exp.id}-merged`, verseId: keepVerseId }))
      );
    }
    await this.deleteVerse(poemId, removeVerseId);
  }

  /**
   * Applies a "split_verse" segmentation suggestion: rewrites `verseId`'s
   * hemistichs to `firstPair`, then inserts a brand-new verse right after it
   * holding `secondPair`, shifting every later verse's order_index up by one.
   * Any alignment/explanations on the original verse stay attached to the
   * first half; the new second-half verse starts with no alignment (it needs
   * re-review) and no explanations.
   */
  async splitVerse(
    poemId: string,
    verseId: string,
    firstPair: { firstHemistich: string; secondHemistich: string },
    secondPair: { firstHemistich: string; secondHemistich: string }
  ): Promise<string> {
    const rows = await this.adapter.select<VerseRow>(
      `SELECT * FROM verses WHERE poem_id = ? ORDER BY order_index ASC;`,
      [poemId]
    );
    const target = rows.find((r) => r.id === verseId);
    if (!target) {
      throw new Error("تعذر العثور على البيت المطلوب تقسيمه.");
    }

    await this.updateVerseText(verseId, firstPair.firstHemistich, firstPair.secondHemistich);

    // Shift later verses' order_index up first (descending order) so the
    // UNIQUE(poem_id, order_index) constraint is never briefly violated.
    const toShift = rows
      .filter((r) => r.order_index > target.order_index)
      .sort((a, b) => b.order_index - a.order_index);
    for (const row of toShift) {
      await this.adapter.execute(`UPDATE verses SET order_index = order_index + 1 WHERE id = ?;`, [row.id]);
    }

    // A plain Date.now() suffix collides when several split_verse suggestions
    // are accepted in the same batch (synchronous adapters can process two
    // splits within the same millisecond), and INSERT OR REPLACE would then
    // silently overwrite one new verse with the other. Add a random suffix
    // to keep every split's new verse id unique.
    const newVerseId = `${verseId}-split-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newText = `${secondPair.firstHemistich} ${secondPair.secondHemistich}`.trim();
    await this.saveVerse({
      id: newVerseId,
      poemId,
      orderIndex: target.order_index + 1,
      text: newText,
      normalizedText: normalizeArabic(newText),
      firstHemistich: secondPair.firstHemistich,
      secondHemistich: secondPair.secondHemistich,
    });

    await this.adapter.execute(
      `UPDATE poems SET verses_count = (SELECT COUNT(*) FROM verses WHERE poem_id = ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
      [poemId, poemId]
    );

    return newVerseId;
  }

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
      explanationType: r.explanation_type as "classical" | "verse" | "manual" | "rhetorical",
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

  // --- Playlist Methods ---
  async createPlaylist(name: string): Promise<Playlist> {
    const id = `playlist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await this.adapter.execute(
      `INSERT INTO playlists (id, name, created_at, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      [id, name]
    );
    const created = await this.getPlaylistById(id);
    if (!created) throw new Error("تعذر إنشاء قائمة التشغيل.");
    return created;
  }

  async renamePlaylist(id: string, name: string): Promise<void> {
    await this.adapter.execute(
      `UPDATE playlists SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
      [name, id]
    );
  }

  async deletePlaylist(id: string): Promise<void> {
    await this.adapter.execute(`DELETE FROM playlist_poems WHERE playlist_id = ?;`, [id]);
    await this.adapter.execute(`DELETE FROM playlists WHERE id = ?;`, [id]);
  }

  private async mapPlaylistRow(row: PlaylistRow): Promise<Playlist> {
    const items = await this.adapter.select<PlaylistPoemRow>(
      `SELECT * FROM playlist_poems WHERE playlist_id = ? ORDER BY order_index ASC;`,
      [row.id]
    );
    return {
      id: row.id,
      name: row.name,
      poemIds: items.map((i) => i.poem_id),
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    };
  }

  async getAllPlaylists(): Promise<Playlist[]> {
    const rows = await this.adapter.select<PlaylistRow>(
      `SELECT * FROM playlists ORDER BY created_at DESC;`
    );
    const playlists: Playlist[] = [];
    for (const r of rows) {
      playlists.push(await this.mapPlaylistRow(r));
    }
    return playlists;
  }

  async getPlaylistById(id: string): Promise<Playlist | null> {
    const rows = await this.adapter.select<PlaylistRow>(
      `SELECT * FROM playlists WHERE id = ? LIMIT 1;`,
      [id]
    );
    if (rows.length === 0) return null;
    return this.mapPlaylistRow(rows[0]);
  }

  async getPlaylistPoems(id: string): Promise<Poem[]> {
    const playlist = await this.getPlaylistById(id);
    if (!playlist) return [];
    const poems: Poem[] = [];
    for (const poemId of playlist.poemIds) {
      const poem = await this.getPoemById(poemId);
      if (poem) poems.push(poem);
    }
    return poems;
  }

  async addPoemToPlaylist(playlistId: string, poemId: string): Promise<void> {
    const existing = await this.adapter.select<PlaylistPoemRow>(
      `SELECT * FROM playlist_poems WHERE playlist_id = ? AND poem_id = ? LIMIT 1;`,
      [playlistId, poemId]
    );
    if (existing.length > 0) return; // already in the playlist

    const rows = await this.adapter.select<PlaylistPoemRow>(
      `SELECT * FROM playlist_poems WHERE playlist_id = ?;`,
      [playlistId]
    );
    const nextIndex = rows.length;
    await this.adapter.execute(
      `INSERT INTO playlist_poems (playlist_id, poem_id, order_index, added_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP);`,
      [playlistId, poemId, nextIndex]
    );
    await this.adapter.execute(
      `UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
      [playlistId]
    );
  }

  async removePoemFromPlaylist(playlistId: string, poemId: string): Promise<void> {
    await this.adapter.execute(
      `DELETE FROM playlist_poems WHERE playlist_id = ? AND poem_id = ?;`,
      [playlistId, poemId]
    );
    // Re-pack order indices so they stay contiguous starting from 0.
    const rows = await this.adapter.select<PlaylistPoemRow>(
      `SELECT * FROM playlist_poems WHERE playlist_id = ? ORDER BY order_index ASC;`,
      [playlistId]
    );
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].order_index !== i) {
        await this.adapter.execute(
          `UPDATE playlist_poems SET order_index = ? WHERE playlist_id = ? AND poem_id = ?;`,
          [i, playlistId, rows[i].poem_id]
        );
      }
    }
    await this.adapter.execute(
      `UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
      [playlistId]
    );
  }

  async reorderPlaylistPoems(playlistId: string, orderedPoemIds: string[]): Promise<void> {
    // Push indices into a temporary negative range first to avoid clashing
    // with the UNIQUE(playlist_id, order_index) constraint mid-update.
    for (let i = 0; i < orderedPoemIds.length; i++) {
      await this.adapter.execute(
        `UPDATE playlist_poems SET order_index = ? WHERE playlist_id = ? AND poem_id = ?;`,
        [-(i + 1), playlistId, orderedPoemIds[i]]
      );
    }
    for (let i = 0; i < orderedPoemIds.length; i++) {
      await this.adapter.execute(
        `UPDATE playlist_poems SET order_index = ? WHERE playlist_id = ? AND poem_id = ?;`,
        [i, playlistId, orderedPoemIds[i]]
      );
    }
    await this.adapter.execute(
      `UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?;`,
      [playlistId]
    );
  }
}
