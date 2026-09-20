import { getDb } from "./index.js";
import { type TrackedPlayer, type TrackedPlayerRow, mapTrackedPlayer } from "./types.js";

export interface AddPlayerInput {
  guildId: string;
  accountId: number;
  steamId64: string;
  discordUserId: string | null;
  displayName: string;
  addedAt?: number;
}

export function addPlayer(input: AddPlayerInput): void {
  getDb()
    .prepare(
      `INSERT INTO tracked_players
         (guild_id, account_id, steam_id64, discord_user_id, display_name, added_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (guild_id, account_id) DO UPDATE SET
         steam_id64 = excluded.steam_id64,
         discord_user_id = excluded.discord_user_id,
         display_name = excluded.display_name`,
    )
    .run(
      input.guildId,
      input.accountId,
      input.steamId64,
      input.discordUserId,
      input.displayName,
      input.addedAt ?? Date.now(),
    );
}

export function removePlayer(guildId: string, accountId: number): number {
  const result = getDb()
    .prepare("DELETE FROM tracked_players WHERE guild_id = ? AND account_id = ?")
    .run(guildId, accountId);
  return result.changes;
}

export function listPlayers(guildId: string): TrackedPlayer[] {
  const rows = getDb()
    .prepare(
      "SELECT * FROM tracked_players WHERE guild_id = ? ORDER BY display_name COLLATE NOCASE",
    )
    .all(guildId);
  return rows.map((row) => mapTrackedPlayer(row as TrackedPlayerRow));
}

export function getPlayer(guildId: string, accountId: number): TrackedPlayer | null {
  const row = getDb()
    .prepare("SELECT * FROM tracked_players WHERE guild_id = ? AND account_id = ?")
    .get(guildId, accountId);
  return row ? mapTrackedPlayer(row as TrackedPlayerRow) : null;
}

export function getPlayersByDiscordId(guildId: string, discordUserId: string): TrackedPlayer[] {
  const rows = getDb()
    .prepare("SELECT * FROM tracked_players WHERE guild_id = ? AND discord_user_id = ?")
    .all(guildId, discordUserId);
  return rows.map((row) => mapTrackedPlayer(row as TrackedPlayerRow));
}
