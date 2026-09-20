import { getDb } from "./index.js";

export function getSeenMatchIds(guildId: string, matchIds: number[]): Set<number> {
  if (matchIds.length === 0) {
    return new Set();
  }
  const placeholders = matchIds.map(() => "?").join(", ");
  const rows = getDb()
    .prepare(
      `SELECT match_id FROM seen_matches WHERE guild_id = ? AND match_id IN (${placeholders})`,
    )
    .all(guildId, ...matchIds) as Array<{ match_id: number }>;
  return new Set(rows.map((row) => row.match_id));
}

export function markMatchesSeen(guildId: string, matchIds: number[], postedAt = Date.now()): void {
  if (matchIds.length === 0) {
    return;
  }
  const db = getDb();
  const insert = db.prepare(
    "INSERT OR IGNORE INTO seen_matches (guild_id, match_id, posted_at) VALUES (?, ?, ?)",
  );
  const tx = db.transaction((ids: number[]) => {
    for (const id of ids) {
      insert.run(guildId, id, postedAt);
    }
  });
  tx(matchIds);
}
