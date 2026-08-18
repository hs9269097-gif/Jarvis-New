// ─────────────────────────────────────────────────────────────────────────────
// DATABASE ABSTRACTION
// JARVIS talks to a `Database` interface. The default implementation is a
// zero-dependency embedded JSON store with write-behind persistence and a
// lightweight migration system. Swap this file's default export for a Postgres
// adapter (set DATABASE_URL) without touching any route/feature code.
// ─────────────────────────────────────────────────────────────────────────────
import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

export type Row = Record<string, unknown>;

export interface Database {
  all<T extends Row>(table: string): T[];
  find<T extends Row>(table: string, id: string): T | undefined;
  query<T extends Row>(table: string, filter: (r: T) => boolean): T[];
  insert(table: string, row: Row): Row;
  update(table: string, id: string, patch: Partial<Row>): Row | undefined;
  remove(table: string, id: string): boolean;
  clear(table: string): void;
}

// ── Schema ────────────────────────────────────────────────────────────────────
export interface Schema {
  version: number;
  collections: Record<string, Record<string, Row>>;
}

const MIGRATIONS: Array<(db: JsonDatabase) => void> = [
  // v1 -> v2: seed nothing, just example hook
  (db) => {
    /* reserved for future migrations */
  },
];

class JsonDatabase implements Database {
  private data: Schema;
  private file: string;
  private dirty = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(file: string) {
    this.file = file;
    this.data = { version: 0, collections: {} };
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.file)) {
        this.data = JSON.parse(fs.readFileSync(this.file, "utf8")) as Schema;
      }
    } catch (e) {
      console.error("[db] corrupt store, starting fresh:", (e as Error).message);
      this.data = { version: 0, collections: {} };
    }
    if (!this.data.collections) this.data.collections = {};
    while (this.data.version < MIGRATIONS.length) {
      MIGRATIONS[this.data.version]?.(this);
      this.data.version += 1;
    }
    if (this.data.version < 1) this.data.version = 1;
  }

  private table(name: string): Record<string, Row> {
    if (!this.data.collections[name]) this.data.collections[name] = {};
    return this.data.collections[name]!;
  }

  private persist() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.data), "utf8");
    }, 150);
  }

  all<T extends Row>(table: string): T[] {
    return Object.values(this.table(table)) as T[];
  }
  find<T extends Row>(table: string, id: string): T | undefined {
    return this.table(table)[id] as T | undefined;
  }
  query<T extends Row>(table: string, filter: (r: T) => boolean): T[] {
    return Object.values(this.table(table)).filter((r) => filter(r as T)) as T[];
  }
  insert(table: string, row: Row): Row {
    this.table(table)[row.id as string] = row;
    this.dirty = true;
    this.persist();
    return row;
  }
  update(table: string, id: string, patch: Partial<Row>): Row | undefined {
    const existing = this.table(table)[id];
    if (!existing) return undefined;
    const next = { ...existing, ...patch, id };
    this.table(table)[id] = next;
    this.dirty = true;
    this.persist();
    return next;
  }
  remove(table: string, id: string): boolean {
    if (!(id in this.table(table))) return false;
    delete this.table(table)[id];
    this.dirty = true;
    this.persist();
    return true;
  }
  clear(table: string) {
    this.data.collections[table] = {};
    this.persist();
  }
}

// ── Default instance ──────────────────────────────────────────────────────────
fs.mkdirSync(config.dataDir, { recursive: true });
export const db: Database = new JsonDatabase(path.join(config.dataDir, "jarvis.db.json"));

export function now(): number {
  return Date.now();
}
export function uid(prefix = "id"): string {
  return `${prefix}_${now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}
