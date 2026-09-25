import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { createDb } from "../src/db/index.js";

describe("createDb migration", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    dirs.length = 0;
  });

  it("adds last_success_at to an existing database", () => {
    const dir = mkdtempSync(join(tmpdir(), "ddh-db-"));
    dirs.push(dir);
    const path = join(dir, "bot.sqlite");

    const legacy = new Database(path);
    legacy.exec(`
      CREATE TABLE guild_config (
        guild_id         TEXT PRIMARY KEY,
        channel_id       TEXT,
        interval_minutes INTEGER NOT NULL DEFAULT 30,
        enabled          INTEGER NOT NULL DEFAULT 0,
        last_run_at      INTEGER,
        last_error_at    INTEGER,
        created_at       INTEGER NOT NULL,
        updated_at       INTEGER NOT NULL
      );
    `);
    legacy.close();

    const db = createDb(path);
    const columns = db.prepare("PRAGMA table_info(guild_config)").all() as Array<{ name: string }>;
    expect(columns.map((column) => column.name)).toContain("last_success_at");
    db.close();
  });
});
