import { PoemRow, PoetRow, VerseRow, RecordingRow, VerseAlignmentRow, WordDefinitionRow, VerseExplanationRow, ImportJobRow, PlaylistRow, PlaylistPoemRow } from "./schema";
import { MOCK_POEMS, MOCK_POETS } from "@/data/mockData";

export interface DatabaseAdapter {
  execute(sql: string, params?: unknown[]): Promise<void>;
  select<T>(sql: string, params?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
}

// In-Memory Database Adapter for Web browser mode and Unit Tests
export class WebMemoryAdapter implements DatabaseAdapter {
  private static readonly STORAGE_KEY = "diwan-web-database-v1";
  private poets = new Map<string, PoetRow>();
  private poems = new Map<string, PoemRow>();
  private verses = new Map<string, VerseRow>();
  private recordings = new Map<string, RecordingRow>();
  private alignments = new Map<string, VerseAlignmentRow>();
  private definitions = new Map<string, WordDefinitionRow>();
  private explanations = new Map<string, VerseExplanationRow>();
  private importJobs = new Map<string, ImportJobRow>();
  private playlists = new Map<string, PlaylistRow>();
  // Keyed by `${playlist_id}::${poem_id}` since this join table has a composite key.
  private playlistPoems = new Map<string, PlaylistPoemRow>();

  constructor() {
    const restored = this.restore();
    if (!restored) {
      this.seedDefaultData();
    } else {
      // A previously-saved browser database may predate newer built-in demo
      // content (e.g. recordings/alignments added later for poem-2/poem-3).
      // Repair any missing built-in pieces without touching user-added data
      // or user-edited alignments on poems that already have them.
      const repaired = this.repairBuiltInDemoContent();
      if (repaired) this.persist();
    }
  }

  /**
   * Ensures every built-in demo poem (MOCK_POEMS) has its poet, verses, and
   * at least one recording with alignments present in the local browser
   * database. This heals installs whose localStorage was seeded from an
   * older version of mockData.ts (e.g. missing audio for some poems), while
   * leaving any already-present data (including user corrections) untouched.
   * Returns true if anything was added.
   */
  private repairBuiltInDemoContent(): boolean {
    let changed = false;

    for (const p of Object.values(MOCK_POETS)) {
      if (!this.poets.has(p.id)) {
        this.poets.set(p.id, {
          id: p.id,
          name: p.name,
          era: p.era,
          bio: p.bio || null,
          birth_year: p.birthYear || null,
          death_year: p.deathYear || null,
          created_at: new Date().toISOString(),
        });
        changed = true;
      }
    }

    for (const p of MOCK_POEMS) {
      if (!this.poems.has(p.id)) {
        this.poems.set(p.id, {
          id: p.id,
          title: p.title,
          poet_id: p.poet.id,
          era: p.era,
          bahr: p.bahr,
          rhyme: p.rhyme,
          description: p.description || null,
          verses_count: p.versesCount,
          tags: JSON.stringify(p.tags || []),
          default_recording_id: p.defaultRecordingId || p.recordings[0]?.id || null,
          external_provider: p.externalProvider || null,
          external_id: p.externalId || null,
          source_url: p.sourceUrl || null,
          theme: p.theme || null,
          verified: p.verified ? 1 : 0,
          cover_image_url: p.coverImageUrl || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        changed = true;
      }

      const hasAnyRecordingForPoem = Array.from(this.recordings.values()).some(
        (rec) => rec.poem_id === p.id
      );
      if (!hasAnyRecordingForPoem) {
        for (const rec of p.recordings) {
          this.recordings.set(rec.id, {
            id: rec.id,
            poem_id: rec.poemId,
            title: rec.title,
            reciter: rec.reciter,
            audio_path: rec.audioPath,
            duration_ms: rec.durationMs,
            sample_rate: rec.sampleRate || null,
            channels: rec.channels || null,
            format: rec.format || null,
            created_at: rec.createdAt || new Date().toISOString(),
          });
          changed = true;
        }
        if (!this.poems.get(p.id)?.default_recording_id && p.recordings[0]) {
          const poemRow = this.poems.get(p.id);
          if (poemRow) {
            poemRow.default_recording_id = p.defaultRecordingId || p.recordings[0].id;
            changed = true;
          }
        }
      }

      const hasAnyVerseForPoem = Array.from(this.verses.values()).some((v) => v.poem_id === p.id);
      if (!hasAnyVerseForPoem) {
        for (const v of p.verses) {
          this.verses.set(v.id, {
            id: v.id,
            poem_id: v.poemId,
            order_index: v.orderIndex,
            text: v.text,
            normalized_text: v.normalizedText,
            first_hemistich: v.firstHemistich,
            second_hemistich: v.secondHemistich,
            explanation: v.explanation || null,
            external_id: v.externalId || null,
            created_at: new Date().toISOString(),
          });
          changed = true;

          if (v.alignment) {
            this.alignments.set(v.alignment.id, {
              id: v.alignment.id,
              verse_id: v.alignment.verseId,
              recording_id: v.alignment.recordingId,
              start_ms: v.alignment.startMs,
              end_ms: v.alignment.endMs,
              confidence: v.alignment.confidence,
              status: v.alignment.status,
              start_token_index: v.alignment.transcriptRange?.startTokenIndex || null,
              end_token_index: v.alignment.transcriptRange?.endTokenIndex || null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
        }
      } else {
        // Verses exist, but this specific recording's alignments may not
        // (e.g. a recording was healed above for a poem that already had
        // verses without alignments). Backfill only missing alignments.
        for (const v of p.verses) {
          if (v.alignment && !this.alignments.has(v.alignment.id)) {
            this.alignments.set(v.alignment.id, {
              id: v.alignment.id,
              verse_id: v.alignment.verseId,
              recording_id: v.alignment.recordingId,
              start_ms: v.alignment.startMs,
              end_ms: v.alignment.endMs,
              confidence: v.alignment.confidence,
              status: v.alignment.status,
              start_token_index: v.alignment.transcriptRange?.startTokenIndex || null,
              end_token_index: v.alignment.transcriptRange?.endTokenIndex || null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
            changed = true;
          }
        }
      }
    }

    return changed;
  }

  private restore(): boolean {
    if (typeof localStorage === "undefined") return false;
    try {
      const raw = localStorage.getItem(WebMemoryAdapter.STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw) as Record<string, unknown>;
      const restoreMap = <T>(key: string) =>
        new Map<string, T>(Array.isArray(data[key]) ? data[key] as [string, T][] : []);
      this.poets = restoreMap<PoetRow>("poets");
      this.poems = restoreMap<PoemRow>("poems");
      this.verses = restoreMap<VerseRow>("verses");
      this.recordings = restoreMap<RecordingRow>("recordings");
      this.alignments = restoreMap<VerseAlignmentRow>("alignments");
      this.definitions = restoreMap<WordDefinitionRow>("definitions");
      this.explanations = restoreMap<VerseExplanationRow>("explanations");
      this.importJobs = restoreMap<ImportJobRow>("importJobs");
      this.playlists = restoreMap<PlaylistRow>("playlists");
      this.playlistPoems = restoreMap<PlaylistPoemRow>("playlistPoems");
      return true;
    } catch (error) {
      console.warn("تعذر استعادة قاعدة البيانات المحلية، سيتم استخدام بيانات البداية.", error);
      return false;
    }
  }

  private persist(): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(
        WebMemoryAdapter.STORAGE_KEY,
        JSON.stringify({
          poets: Array.from(this.poets.entries()),
          poems: Array.from(this.poems.entries()),
          verses: Array.from(this.verses.entries()),
          recordings: Array.from(this.recordings.entries()),
          alignments: Array.from(this.alignments.entries()),
          definitions: Array.from(this.definitions.entries()),
          explanations: Array.from(this.explanations.entries()),
          importJobs: Array.from(this.importJobs.entries()),
          playlists: Array.from(this.playlists.entries()),
          playlistPoems: Array.from(this.playlistPoems.entries()),
        })
      );
    } catch (error) {
      console.warn("تعذر حفظ قاعدة البيانات المحلية في المتصفح.", error);
    }
  }

  private seedDefaultData() {
    // Seed Poets
    for (const p of Object.values(MOCK_POETS)) {
      this.poets.set(p.id, {
        id: p.id,
        name: p.name,
        era: p.era,
        bio: p.bio || null,
        birth_year: p.birthYear || null,
        death_year: p.deathYear || null,
        created_at: new Date().toISOString(),
      });
    }

    // Seed Poems
    for (const p of MOCK_POEMS) {
      this.poems.set(p.id, {
        id: p.id,
        title: p.title,
        poet_id: p.poet.id,
        era: p.era,
        bahr: p.bahr,
        rhyme: p.rhyme,
        description: p.description || null,
        verses_count: p.versesCount,
        tags: JSON.stringify(p.tags || []),
        default_recording_id: p.defaultRecordingId || p.recordings[0]?.id || null,
        external_provider: p.externalProvider || null,
        external_id: p.externalId || null,
        source_url: p.sourceUrl || null,
        theme: p.theme || null,
        verified: p.verified ? 1 : 0,
        cover_image_url: p.coverImageUrl || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      for (const rec of p.recordings) {
        this.recordings.set(rec.id, {
          id: rec.id,
          poem_id: rec.poemId,
          title: rec.title,
          reciter: rec.reciter,
          audio_path: rec.audioPath,
          duration_ms: rec.durationMs,
          sample_rate: rec.sampleRate || null,
          channels: rec.channels || null,
          format: rec.format || null,
          created_at: rec.createdAt || new Date().toISOString(),
        });
      }

      for (const v of p.verses) {
        this.verses.set(v.id, {
          id: v.id,
          poem_id: v.poemId,
          order_index: v.orderIndex,
          text: v.text,
          normalized_text: v.normalizedText,
          first_hemistich: v.firstHemistich,
          second_hemistich: v.secondHemistich,
          explanation: v.explanation || null,
          external_id: v.externalId || null,
          created_at: new Date().toISOString(),
        });

        if (v.alignment) {
          this.alignments.set(v.alignment.id, {
            id: v.alignment.id,
            verse_id: v.alignment.verseId,
            recording_id: v.alignment.recordingId,
            start_ms: v.alignment.startMs,
            end_ms: v.alignment.endMs,
            confidence: v.alignment.confidence,
            status: v.alignment.status,
            start_token_index: v.alignment.transcriptRange?.startTokenIndex || null,
            end_token_index: v.alignment.transcriptRange?.endTokenIndex || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }
    }

    // Default dictionary sample
    const sampleWords = [
      { id: "w-1", word: "شَبِمُ", normalized_word: "شبم", root: "شبم", meaning: "بارد، يقال: ماءٌ شبِمٌ أي بارد يطفئ العطش.", source: "لسان العرب" },
      { id: "w-2", word: "سَقَمُ", normalized_word: "سقم", root: "سقم", meaning: "المرض والعلّة الطويلة المؤلمة.", source: "الصحاح في اللغة" },
      { id: "w-3", word: "بَرَى", normalized_word: "برى", root: "بري", meaning: "نحَل وأضنى وأضعف الجسد من شدّة الوجد.", source: "معجم مقاييس اللغة" },
      { id: "w-4", word: "غُرَّتِهِ", normalized_word: "غرته", root: "غرر", meaning: "وجهه المشرق وبهاء طلعته ومقدمة رأسه.", source: "لسان العرب" },
    ];
    for (const w of sampleWords) {
      this.definitions.set(w.id, { ...w, created_at: new Date().toISOString() });
    }
  }

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    const trimmed = sql.trim();

    if (trimmed.startsWith("INSERT OR REPLACE INTO poets") || trimmed.startsWith("INSERT INTO poets")) {
      const id = String(params[0]);
      this.poets.set(id, {
        id,
        name: String(params[1]),
        era: String(params[2]),
        bio: params[3] ? String(params[3]) : null,
        birth_year: params[4] ? String(params[4]) : null,
        death_year: params[5] ? String(params[5]) : null,
        created_at: new Date().toISOString(),
      });
    } else if (trimmed.startsWith("INSERT OR REPLACE INTO poems") || trimmed.startsWith("INSERT INTO poems")) {
      const id = String(params[0]);
      this.poems.set(id, {
        id,
        title: String(params[1]),
        poet_id: String(params[2]),
        era: String(params[3]),
        bahr: String(params[4]),
        rhyme: String(params[5]),
        description: params[6] ? String(params[6]) : null,
        verses_count: Number(params[7]),
        tags: String(params[8] || "[]"),
        default_recording_id: params[9] ? String(params[9]) : null,
        external_provider: params[10] ? String(params[10]) : null,
        external_id: params[11] ? String(params[11]) : null,
        source_url: params[12] ? String(params[12]) : null,
        theme: params[13] ? String(params[13]) : null,
        verified: params[14] ? 1 : 0,
        cover_image_url: params[15] ? String(params[15]) : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } else if (trimmed.startsWith("INSERT OR REPLACE INTO verses") || trimmed.startsWith("INSERT INTO verses")) {
      const id = String(params[0]);
      this.verses.set(id, {
        id,
        poem_id: String(params[1]),
        order_index: Number(params[2]),
        text: String(params[3]),
        normalized_text: String(params[4]),
        first_hemistich: String(params[5]),
        second_hemistich: String(params[6]),
        explanation: params[7] ? String(params[7]) : null,
        external_id: params[8] ? String(params[8]) : null,
        created_at: new Date().toISOString(),
      });
    } else if (trimmed.startsWith("INSERT OR REPLACE INTO verse_explanations") || trimmed.startsWith("INSERT INTO verse_explanations")) {
      const id = String(params[0]);
      this.explanations.set(id, {
        id,
        verse_id: String(params[1]),
        verse_external_id: params[2] ? String(params[2]) : null,
        text: String(params[3]),
        author: params[4] ? String(params[4]) : null,
        author_death_hijri: params[5] ? String(params[5]) : null,
        source_title: params[6] ? String(params[6]) : null,
        explanation_type: String(params[7]),
        provider: String(params[8]),
        raw_source_json: params[9] ? String(params[9]) : null,
        created_at: new Date().toISOString(),
      });
    } else if (trimmed.startsWith("INSERT OR REPLACE INTO recordings") || trimmed.startsWith("INSERT INTO recordings")) {
      const id = String(params[0]);
      this.recordings.set(id, {
        id,
        poem_id: String(params[1]),
        title: String(params[2]),
        reciter: String(params[3]),
        audio_path: String(params[4]),
        duration_ms: Number(params[5]),
        sample_rate: params[6] ? Number(params[6]) : null,
        channels: params[7] ? Number(params[7]) : null,
        format: params[8] ? String(params[8]) : null,
        created_at: new Date().toISOString(),
      });
    } else if (trimmed.startsWith("INSERT OR REPLACE INTO verse_alignments") || trimmed.startsWith("INSERT INTO verse_alignments")) {
      const id = String(params[0]);
      this.alignments.set(id, {
        id,
        verse_id: String(params[1]),
        recording_id: String(params[2]),
        start_ms: Number(params[3]),
        end_ms: Number(params[4]),
        confidence: Number(params[5]),
        status: String(params[6]),
        start_token_index: params[7] !== null && params[7] !== undefined ? Number(params[7]) : null,
        end_token_index: params[8] !== null && params[8] !== undefined ? Number(params[8]) : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } else if (trimmed.startsWith("UPDATE verse_alignments")) {
      const id = String(params[4]);
      const existing = this.alignments.get(id);
      if (existing) {
        this.alignments.set(id, {
          ...existing,
          start_ms: Number(params[0]),
          end_ms: Number(params[1]),
          status: String(params[2]) as "auto" | "review" | "reviewed" | "manual",
          confidence: params[3] === null || params[3] === undefined
            ? existing.confidence
            : Number(params[3]),
          updated_at: new Date().toISOString(),
        });
      }
    } else if (trimmed.startsWith("INSERT OR REPLACE INTO import_jobs") || trimmed.startsWith("INSERT INTO import_jobs")) {
      const id = String(params[0]);
      this.importJobs.set(id, {
        id,
        status: String(params[1]),
        job_type: String(params[2]),
        input_path: params[3] ? String(params[3]) : null,
        output_path: params[4] ? String(params[4]) : null,
        progress: Number(params[5] || 0),
        error_message: params[6] ? String(params[6]) : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } else if (trimmed.startsWith("UPDATE verses SET text = ?, normalized_text = ?, first_hemistich = ?, second_hemistich = ?")) {
      const id = String(params[4]);
      const existing = this.verses.get(id);
      if (existing) {
        this.verses.set(id, {
          ...existing,
          text: String(params[0]),
          normalized_text: String(params[1]),
          first_hemistich: String(params[2]),
          second_hemistich: String(params[3]),
        });
      }
    } else if (trimmed.startsWith("UPDATE verses SET order_index = order_index - 1 WHERE id = ?")) {
      const id = String(params[0]);
      const existing = this.verses.get(id);
      if (existing) this.verses.set(id, { ...existing, order_index: existing.order_index - 1 });
    } else if (trimmed.startsWith("UPDATE verses SET order_index = order_index + 1 WHERE id = ?")) {
      const id = String(params[0]);
      const existing = this.verses.get(id);
      if (existing) this.verses.set(id, { ...existing, order_index: existing.order_index + 1 });
    } else if (trimmed.startsWith("DELETE FROM verse_alignments WHERE verse_id = ?")) {
      const verseId = String(params[0]);
      for (const [aid, a] of this.alignments.entries()) {
        if (a.verse_id === verseId) this.alignments.delete(aid);
      }
    } else if (trimmed.startsWith("DELETE FROM verse_explanations WHERE verse_id = ?")) {
      const verseId = String(params[0]);
      for (const [eid, e] of this.explanations.entries()) {
        if (e.verse_id === verseId) this.explanations.delete(eid);
      }
    } else if (trimmed.startsWith("DELETE FROM verses WHERE id = ?")) {
      const id = String(params[0]);
      this.verses.delete(id);
    } else if (trimmed.startsWith("UPDATE poems SET verses_count = (SELECT COUNT(*) FROM verses WHERE poem_id = ?)")) {
      const poemId = String(params[1]);
      const existing = this.poems.get(poemId);
      if (existing) {
        const count = Array.from(this.verses.values()).filter((v) => v.poem_id === poemId).length;
        this.poems.set(poemId, { ...existing, verses_count: count, updated_at: new Date().toISOString() });
      }
    } else if (trimmed.startsWith("UPDATE poems SET cover_image_url")) {
      const id = String(params[1]);
      const existing = this.poems.get(id);
      if (existing) {
        this.poems.set(id, {
          ...existing,
          cover_image_url: params[0] ? String(params[0]) : null,
          updated_at: new Date().toISOString(),
        });
      }
    } else if (trimmed.startsWith("DELETE FROM playlist_poems WHERE poem_id = ?")) {
      const poemId = String(params[0]);
      for (const [key, row] of this.playlistPoems.entries()) {
        if (row.poem_id === poemId) this.playlistPoems.delete(key);
      }
    } else if (trimmed.startsWith("DELETE FROM verse_alignments WHERE verse_id IN (SELECT id FROM verses WHERE poem_id = ?)")) {
      const poemId = String(params[0]);
      const verseIds = new Set(
        Array.from(this.verses.values())
          .filter((v) => v.poem_id === poemId)
          .map((v) => v.id)
      );
      for (const [aid, a] of this.alignments.entries()) {
        if (verseIds.has(a.verse_id)) this.alignments.delete(aid);
      }
    } else if (trimmed.startsWith("DELETE FROM verse_explanations WHERE verse_id IN (SELECT id FROM verses WHERE poem_id = ?)")) {
      const poemId = String(params[0]);
      const verseIds = new Set(
        Array.from(this.verses.values())
          .filter((v) => v.poem_id === poemId)
          .map((v) => v.id)
      );
      for (const [eid, e] of this.explanations.entries()) {
        if (verseIds.has(e.verse_id)) this.explanations.delete(eid);
      }
    } else if (trimmed.startsWith("DELETE FROM verses WHERE poem_id = ?")) {
      const poemId = String(params[0]);
      for (const [vid, v] of this.verses.entries()) {
        if (v.poem_id === poemId) this.verses.delete(vid);
      }
    } else if (trimmed.startsWith("DELETE FROM recordings WHERE poem_id = ?")) {
      const poemId = String(params[0]);
      for (const [rid, r] of this.recordings.entries()) {
        if (r.poem_id === poemId) this.recordings.delete(rid);
      }
    } else if (trimmed === "DELETE FROM playlist_poems;" || trimmed === "DELETE FROM playlist_poems") {
      this.playlistPoems.clear();
    } else if (trimmed === "DELETE FROM verse_alignments;" || trimmed === "DELETE FROM verse_alignments") {
      this.alignments.clear();
    } else if (trimmed === "DELETE FROM verse_explanations;" || trimmed === "DELETE FROM verse_explanations") {
      this.explanations.clear();
    } else if (trimmed === "DELETE FROM verses;" || trimmed === "DELETE FROM verses") {
      this.verses.clear();
    } else if (trimmed === "DELETE FROM recordings;" || trimmed === "DELETE FROM recordings") {
      this.recordings.clear();
    } else if (trimmed === "DELETE FROM poems;" || trimmed === "DELETE FROM poems") {
      this.poems.clear();
      this.verses.clear();
      this.recordings.clear();
      this.alignments.clear();
      this.explanations.clear();
      this.playlistPoems.clear();
    } else if (trimmed.startsWith("DELETE FROM poems WHERE id = ?")) {
      const id = String(params[0]);
      this.poems.delete(id);
      const verseIds = new Set<string>();
      for (const [vid, v] of this.verses.entries()) {
        if (v.poem_id === id) {
          verseIds.add(vid);
          this.verses.delete(vid);
        }
      }
      for (const [aid, a] of this.alignments.entries()) {
        if (verseIds.has(a.verse_id)) this.alignments.delete(aid);
      }
      for (const [eid, e] of this.explanations.entries()) {
        if (verseIds.has(e.verse_id)) this.explanations.delete(eid);
      }
      for (const [rid, r] of this.recordings.entries()) {
        if (r.poem_id === id) this.recordings.delete(rid);
      }
      for (const [key, pp] of this.playlistPoems.entries()) {
        if (pp.poem_id === id) this.playlistPoems.delete(key);
      }
    } else if (trimmed.startsWith("INSERT INTO playlists")) {
      const id = String(params[0]);
      this.playlists.set(id, {
        id,
        name: String(params[1]),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } else if (trimmed.startsWith("UPDATE playlists SET name")) {
      const id = String(params[1]);
      const existing = this.playlists.get(id);
      if (existing) {
        this.playlists.set(id, { ...existing, name: String(params[0]), updated_at: new Date().toISOString() });
      }
    } else if (trimmed.startsWith("UPDATE playlists SET updated_at")) {
      const id = String(params[0]);
      const existing = this.playlists.get(id);
      if (existing) {
        this.playlists.set(id, { ...existing, updated_at: new Date().toISOString() });
      }
    } else if (trimmed.startsWith("DELETE FROM playlist_poems WHERE playlist_id = ? AND poem_id = ?")) {
      const playlistId = String(params[0]);
      const poemId = String(params[1]);
      this.playlistPoems.delete(`${playlistId}::${poemId}`);
    } else if (trimmed.startsWith("DELETE FROM playlist_poems WHERE playlist_id = ?")) {
      const playlistId = String(params[0]);
      for (const [key, row] of this.playlistPoems.entries()) {
        if (row.playlist_id === playlistId) this.playlistPoems.delete(key);
      }
    } else if (trimmed.startsWith("DELETE FROM playlists WHERE id = ?")) {
      const id = String(params[0]);
      this.playlists.delete(id);
    } else if (trimmed.startsWith("INSERT INTO playlist_poems")) {
      const playlistId = String(params[0]);
      const poemId = String(params[1]);
      this.playlistPoems.set(`${playlistId}::${poemId}`, {
        playlist_id: playlistId,
        poem_id: poemId,
        order_index: Number(params[2]),
        added_at: new Date().toISOString(),
      });
    } else if (trimmed.startsWith("UPDATE playlist_poems SET order_index")) {
      const playlistId = String(params[1]);
      const poemId = String(params[2]);
      const key = `${playlistId}::${poemId}`;
      const existing = this.playlistPoems.get(key);
      if (existing) {
        this.playlistPoems.set(key, { ...existing, order_index: Number(params[0]) });
      }
    }
    this.persist();
  }

  async select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const trimmed = sql.trim();

    if (trimmed.includes("FROM poems WHERE external_provider = ? AND external_id = ?")) {
      const provider = String(params[0]);
      const extId = String(params[1]);
      const found = Array.from(this.poems.values()).find(
        (p) => p.external_provider === provider && p.external_id === extId
      );
      return found ? ([found] as unknown as T[]) : [];
    }

    if (trimmed.includes("FROM poems WHERE id = ?")) {
      const id = String(params[0]);
      const poem = this.poems.get(id);
      return poem ? ([poem] as unknown as T[]) : [];
    }

    if (trimmed.includes("FROM poems")) {
      return Array.from(this.poems.values()) as unknown as T[];
    }

    if (trimmed.includes("FROM poets WHERE id = ?")) {
      const id = String(params[0]);
      const poet = this.poets.get(id);
      return poet ? ([poet] as unknown as T[]) : [];
    }

    if (trimmed.includes("FROM poets")) {
      return Array.from(this.poets.values()) as unknown as T[];
    }

    if (trimmed.includes("FROM verses WHERE poem_id = ?")) {
      const poemId = String(params[0]);
      const list = Array.from(this.verses.values())
        .filter((v) => v.poem_id === poemId)
        .sort((a, b) => a.order_index - b.order_index);
      return list as unknown as T[];
    }

    if (trimmed.includes("FROM verse_explanations WHERE verse_id = ?")) {
      const verseId = String(params[0]);
      const list = Array.from(this.explanations.values()).filter((e) => e.verse_id === verseId);
      return list as unknown as T[];
    }

    if (trimmed.includes("FROM recordings WHERE poem_id = ?")) {
      const poemId = String(params[0]);
      const list = Array.from(this.recordings.values()).filter((r) => r.poem_id === poemId);
      return list as unknown as T[];
    }

    if (trimmed.includes("FROM verse_alignments WHERE verse_id = ? AND recording_id = ?")) {
      const verseId = String(params[0]);
      const recordingId = String(params[1]);
      const align = Array.from(this.alignments.values()).find(
        (a) => a.verse_id === verseId && a.recording_id === recordingId
      );
      return align ? ([align] as unknown as T[]) : [];
    }

    if (trimmed.includes("FROM verse_alignments WHERE verse_id = ?")) {
      const verseId = String(params[0]);
      const align = Array.from(this.alignments.values())
        .filter((a) => a.verse_id === verseId)
        .sort((a, b) => {
          const rank = (status: string) => (status === "manual" ? 0 : status === "reviewed" ? 1 : 2);
          return rank(a.status) - rank(b.status);
        })[0];
      return align ? ([align] as unknown as T[]) : [];
    }

    if (trimmed.includes("FROM word_definitions")) {
      const search = String(params[0] || "");
      const found = Array.from(this.definitions.values()).find(
        (d) => d.normalized_word === search || d.word === search || d.root === search
      );
      return found ? ([found] as unknown as T[]) : [];
    }

    if (trimmed.includes("FROM import_jobs WHERE id = ?")) {
      const id = String(params[0]);
      const job = this.importJobs.get(id);
      return job ? ([job] as unknown as T[]) : [];
    }

    if (trimmed.includes("FROM playlist_poems WHERE playlist_id = ? AND poem_id = ?")) {
      const playlistId = String(params[0]);
      const poemId = String(params[1]);
      const row = this.playlistPoems.get(`${playlistId}::${poemId}`);
      return row ? ([row] as unknown as T[]) : [];
    }

    if (trimmed.includes("FROM playlist_poems WHERE playlist_id = ?")) {
      const playlistId = String(params[0]);
      const list = Array.from(this.playlistPoems.values())
        .filter((r) => r.playlist_id === playlistId)
        .sort((a, b) => a.order_index - b.order_index);
      return list as unknown as T[];
    }

    if (trimmed.includes("FROM playlists WHERE id = ?")) {
      const id = String(params[0]);
      const row = this.playlists.get(id);
      return row ? ([row] as unknown as T[]) : [];
    }

    if (trimmed.includes("FROM playlists")) {
      const list = Array.from(this.playlists.values()).sort((a, b) =>
        (b.created_at || "").localeCompare(a.created_at || "")
      );
      return list as unknown as T[];
    }

    return [] as T[];
  }

  async close(): Promise<void> {}
}

interface TauriPluginSqlDatabase {
  execute(sql: string, params?: unknown[]): Promise<unknown>;
  select<T>(sql: string, params?: unknown[]): Promise<T[]>;
  close(): Promise<boolean>;
}

// Tauri 2 Official SQL Plugin Adapter
export class TauriSqlAdapter implements DatabaseAdapter {
  private db: TauriPluginSqlDatabase;

  constructor(db: TauriPluginSqlDatabase) {
    this.db = db;
  }

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    await this.db.execute(sql, params);
  }

  async select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return await this.db.select<T>(sql, params);
  }

  async close(): Promise<void> {
    await this.db.close();
  }
}

// Better SQLite Adapter for Node / Vitest tests
export class BetterSqliteAdapter implements DatabaseAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private db: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(db: any) {
    this.db = db;
  }

  static async create(path: string = ":memory:"): Promise<BetterSqliteAdapter> {
    const { createRequire } = await import("module");
    const require = createRequire(import.meta.url);
    const DatabaseConstructor = require("better-sqlite3");
    const db = new DatabaseConstructor(path);
    return new BetterSqliteAdapter(db);
  }

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    if (params.length === 0) {
      this.db.exec(sql);
    } else {
      this.db.prepare(sql).run(...params);
    }
  }

  async select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.db.prepare(sql).all(...params) as T[];
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

// Universal database factory
export async function getDatabase(): Promise<DatabaseAdapter> {
  const isTauri =
    typeof window !== "undefined" &&
    ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);

  if (isTauri) {
    try {
      const Database = (await import("@tauri-apps/plugin-sql")).default;
      const db = await Database.load("sqlite:diwan.db");
      return new TauriSqlAdapter(db);
    } catch (err) {
      console.warn("Failed to load Tauri SQL plugin, falling back to Web in-memory DB:", err);
      return new WebMemoryAdapter();
    }
  }

  // Node.js test environment
  const g = typeof globalThis !== "undefined" ? (globalThis as unknown as { process?: { versions?: { node?: string } } }) : undefined;
  if (g && g.process && g.process.versions && g.process.versions.node) {
    try {
      return await BetterSqliteAdapter.create(":memory:");
    } catch {
      return new WebMemoryAdapter();
    }
  }

  return new WebMemoryAdapter();
}

