import { INITIAL_SCHEMA_SQL } from "./schema";
import { MOCK_POEMS, MOCK_POETS } from "@/data/mockData";
import { PoetRow, PoemRow, VerseRow, VerseAlignmentRow, RecordingRow, WordDefinitionRow } from "./schema";

export interface DatabaseAdapter {
  execute(sql: string, params?: unknown[]): Promise<void>;
  select<T>(sql: string, params?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
}

// In-Memory SQLite adapter for Node.js / Vitest tests
export class BetterSqliteAdapter implements DatabaseAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private db: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(dbInstance: any) {
    this.db = dbInstance;
    this.db.pragma("foreign_keys = ON");
  }

  static async create(filename = ":memory:"): Promise<BetterSqliteAdapter> {
    const Database = (await import("better-sqlite3")).default;
    const db = new Database(filename);
    return new BetterSqliteAdapter(db);
  }

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    if (params.length === 0 && sql.includes(";")) {
      this.db.exec(sql);
      return;
    }
    const stmt = this.db.prepare(sql);
    stmt.run(...params);
  }

  async select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

// Web Browser fallback with In-Memory + LocalStorage persistence
export class WebMemoryAdapter implements DatabaseAdapter {
  private poets: Map<string, PoetRow> = new Map();
  private poems: Map<string, PoemRow> = new Map();
  private verses: Map<string, VerseRow> = new Map();
  private alignments: Map<string, VerseAlignmentRow> = new Map();
  private recordings: Map<string, RecordingRow> = new Map();
  private definitions: Map<string, WordDefinitionRow> = new Map();

  constructor() {
    this.seedDefaultData();
  }

  private seedDefaultData() {
    // Populate default data for rich web browser experience
    for (const poet of Object.values(MOCK_POETS)) {
      this.poets.set(poet.id, {
        id: poet.id,
        name: poet.name,
        era: poet.era,
        bio: poet.bio || null,
        birth_year: poet.birthYear || null,
        death_year: poet.deathYear || null,
        created_at: new Date().toISOString(),
      });
    }

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

    if (trimmed.startsWith("INSERT OR REPLACE INTO poems") || trimmed.startsWith("INSERT INTO poems")) {
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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } else if (trimmed.startsWith("UPDATE verse_alignments")) {
      // params: [startMs, endMs, status, confidence, id]
      const id = String(params[4]);
      const existing = this.alignments.get(id);
      if (existing) {
        this.alignments.set(id, {
          ...existing,
          start_ms: Number(params[0]),
          end_ms: Number(params[1]),
          status: String(params[2]) as "auto" | "reviewed" | "manual",
          confidence: Number(params[3]),
          updated_at: new Date().toISOString(),
        });
      }
    }
  }

  async select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const trimmed = sql.trim();

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

    if (trimmed.includes("FROM recordings WHERE poem_id = ?")) {
      const poemId = String(params[0]);
      const list = Array.from(this.recordings.values()).filter((r) => r.poem_id === poemId);
      return list as unknown as T[];
    }

    if (trimmed.includes("FROM verse_alignments WHERE verse_id = ?")) {
      const verseId = String(params[0]);
      const align = Array.from(this.alignments.values()).find((a) => a.verse_id === verseId);
      return align ? ([align] as unknown as T[]) : [];
    }

    if (trimmed.includes("FROM word_definitions")) {
      const search = String(params[0] || "");
      const found = Array.from(this.definitions.values()).find(
        (d) => d.normalized_word === search || d.word === search || d.root === search
      );
      return found ? ([found] as unknown as T[]) : [];
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

  static async connect(dbPath = "sqlite:diwan.db"): Promise<TauriSqlAdapter> {
    const { default: DatabaseLoader } = await import("@tauri-apps/plugin-sql");
    const db = (await DatabaseLoader.load(dbPath)) as unknown as TauriPluginSqlDatabase;
    return new TauriSqlAdapter(db);
  }

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      await this.db.execute(statement, params);
    }
  }

  async select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return await this.db.select<T>(sql, params);
  }

  async close(): Promise<void> {
    await this.db.close();
  }
}

let activeAdapter: DatabaseAdapter | null = null;

export async function getDatabase(): Promise<DatabaseAdapter> {
  if (activeAdapter) {
    return activeAdapter;
  }

  // Detect runtime environment
  const isTauri = typeof window !== "undefined" && ("__TAURI_INTERNALS__" in window || "__TAURI__" in window);
  const isNode = typeof globalThis !== "undefined" && "process" in globalThis && typeof window === "undefined";

  if (isTauri) {
    try {
      activeAdapter = await TauriSqlAdapter.connect("sqlite:diwan.db");
      await activeAdapter.execute(INITIAL_SCHEMA_SQL);
      return activeAdapter;
    } catch (e) {
      console.warn("Failed to connect via TauriSqlAdapter, falling back:", e);
    }
  }

  if (isNode) {
    activeAdapter = await BetterSqliteAdapter.create(":memory:");
    await activeAdapter.execute(INITIAL_SCHEMA_SQL);
    return activeAdapter;
  }

  // Fallback for browser dev
  activeAdapter = new WebMemoryAdapter();
  return activeAdapter;
}

export function setDatabaseAdapter(adapter: DatabaseAdapter | null) {
  activeAdapter = adapter;
}
