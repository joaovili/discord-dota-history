import { getDb } from "./index.js";
import { type GuildConfig, type GuildConfigRow, mapGuildConfig } from "./types.js";

export function ensureGuild(
  guildId: string,
  defaultIntervalMinutes: number,
  now = Date.now(),
): void {
  getDb()
    .prepare(
      `INSERT INTO guild_config (guild_id, channel_id, interval_minutes, enabled, created_at, updated_at)
       VALUES (?, NULL, ?, 0, ?, ?)
       ON CONFLICT (guild_id) DO NOTHING`,
    )
    .run(guildId, defaultIntervalMinutes, now, now);
}

export function getGuildConfig(guildId: string): GuildConfig | null {
  const row = getDb().prepare("SELECT * FROM guild_config WHERE guild_id = ?").get(guildId);
  return row ? mapGuildConfig(row as GuildConfigRow) : null;
}

export function setGuildChannel(guildId: string, channelId: string, now = Date.now()): void {
  getDb()
    .prepare("UPDATE guild_config SET channel_id = ?, updated_at = ? WHERE guild_id = ?")
    .run(channelId, now, guildId);
}

export function setGuildInterval(guildId: string, minutes: number, now = Date.now()): void {
  getDb()
    .prepare("UPDATE guild_config SET interval_minutes = ?, updated_at = ? WHERE guild_id = ?")
    .run(minutes, now, guildId);
}

export function setGuildEnabled(guildId: string, enabled: boolean, now = Date.now()): void {
  getDb()
    .prepare("UPDATE guild_config SET enabled = ?, updated_at = ? WHERE guild_id = ?")
    .run(enabled ? 1 : 0, now, guildId);
}

export function setGuildLastRun(guildId: string, lastRunAt: number): void {
  getDb()
    .prepare("UPDATE guild_config SET last_run_at = ?, updated_at = ? WHERE guild_id = ?")
    .run(lastRunAt, lastRunAt, guildId);
}

export function recordGuildError(guildId: string, at = Date.now()): void {
  getDb().prepare("UPDATE guild_config SET last_error_at = ? WHERE guild_id = ?").run(at, guildId);
}

export function clearGuildError(guildId: string): void {
  getDb().prepare("UPDATE guild_config SET last_error_at = NULL WHERE guild_id = ?").run(guildId);
}

export function listEnabledGuilds(): GuildConfig[] {
  const rows = getDb().prepare("SELECT * FROM guild_config WHERE enabled = 1").all();
  return rows.map((row) => mapGuildConfig(row as GuildConfigRow));
}
