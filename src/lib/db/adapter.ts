import { INITIAL_SCHEMA_SQL } from "./schema";
import Database from "better-sqlite3";

export interface DatabaseAdapter {
  execute(sql: string, params?: unknown[]): Promise<void>;
  select<T>(sql: string, params?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
}

// In-Memory SQLite adapter for Node.js / Vitest tests
export class BetterSqliteAdapter implements DatabaseAdapter {
  private db: Database.Database;

  constructor(filename = ":memory:") {
    this.db = new Database(filename);
    this.db.pragma("foreign_keys = ON");
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

// Web / LocalStorage fallback for browser development without Tauri
export class WebMemoryAdapter implements DatabaseAdapter {
  private tables: Map<string, Map<string, unknown[]>> = new Map();
  private storageKey = "diwan_local_db_v1";

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const data = window.localStorage.getItem(this.storageKey);
        if (data) {
          const parsed = JSON.parse(data) as Record<string, Record<string, unknown[]>>;
          for (const [table, rows] of Object.entries(parsed)) {
            this.tables.set(table, new Map(Object.entries(rows)));
          }
        }
      }
    } catch {
      // Ignore storage errors
    }
  }

  private saveToStorage() {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const obj: Record<string, Record<string, unknown[]>> = {};
        for (const [table, rows] of this.tables.entries()) {
          obj[table] = Object.fromEntries(rows.entries());
        }
        window.localStorage.setItem(this.storageKey, JSON.stringify(obj));
      }
    } catch {
      // Ignore storage errors
    }
  }

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    const trimmed = sql.trim();
    if (trimmed.startsWith("INSERT") || trimmed.startsWith("REPLACE")) {
      const match = trimmed.match(/INTO\s+([a-zA-Z0-9_]+)/i);
      if (match && params.length > 0) {
        const table = match[1];
        if (!this.tables.has(table)) this.tables.set(table, new Map());
        const id = String(params[0]);
        this.tables.get(table)!.set(id, params);
        this.saveToStorage();
      }
    } else if (trimmed.startsWith("DELETE")) {
      const match = trimmed.match(/FROM\s+([a-zA-Z0-9_]+)/i);
      if (match && params.length > 0) {
        const table = match[1];
        this.tables.get(table)?.delete(String(params[0]));
        this.saveToStorage();
      }
    }
  }

  async select<T>(_sql: string, _params: unknown[] = []): Promise<T[]> {
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
    activeAdapter = new BetterSqliteAdapter(":memory:");
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
