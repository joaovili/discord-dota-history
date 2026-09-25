import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS guild_config (
  guild_id         TEXT PRIMARY KEY,
  channel_id       TEXT,
  interval_minutes INTEGER NOT NULL DEFAULT 30,
  enabled          INTEGER NOT NULL DEFAULT 0,
  last_run_at      INTEGER,
  last_success_at  INTEGER,
  last_error_at    INTEGER,
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tracked_players (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id        TEXT NOT NULL,
  account_id      INTEGER NOT NULL,
  steam_id64      TEXT NOT NULL,
  discord_user_id TEXT,
  display_name    TEXT NOT NULL,
  added_at        INTEGER NOT NULL,
  UNIQUE (guild_id, account_id)
);
CREATE INDEX IF NOT EXISTS idx_tracked_players_guild ON tracked_players (guild_id);

CREATE TABLE IF NOT EXISTS seen_matches (
  guild_id  TEXT NOT NULL,
  match_id  INTEGER NOT NULL,
  posted_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, match_id)
);
`;

let instance: Database.Database | null = null;

function migrate(db: Database.Database): void {
  const columns = db.prepare("PRAGMA table_info(guild_config)").all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "last_success_at")) {
    db.exec("ALTER TABLE guild_config ADD COLUMN last_success_at INTEGER");
  }
}

export function createDb(path: string): Database.Database {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  migrate(db);
  if (path !== ":memory:") {
    db.pragma("busy_timeout = 5000");
  }
  return db;
}

export function initDb(path: string): Database.Database {
  instance = createDb(path);
  return instance;
}

export function getDb(): Database.Database {
  if (!instance) {
    throw new Error("Database not initialised. Call initDb() first.");
  }
  return instance;
}

export function setDbForTesting(db: Database.Database): void {
  instance = db;
}

export function closeDb(): void {
  instance?.close();
  instance = null;
}

export type Db = Database.Database;
