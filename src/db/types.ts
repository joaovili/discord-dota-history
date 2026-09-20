export interface GuildConfig {
  guildId: string;
  channelId: string | null;
  intervalMinutes: number;
  enabled: boolean;
  lastRunAt: number | null;
  lastErrorAt: number | null;
}

export interface TrackedPlayer {
  id: number;
  guildId: string;
  accountId: number;
  steamId64: string;
  discordUserId: string | null;
  displayName: string;
  addedAt: number;
}

export interface GuildConfigRow {
  guild_id: string;
  channel_id: string | null;
  interval_minutes: number;
  enabled: number;
  last_run_at: number | null;
  last_error_at: number | null;
}

export interface TrackedPlayerRow {
  id: number;
  guild_id: string;
  account_id: number;
  steam_id64: string;
  discord_user_id: string | null;
  display_name: string;
  added_at: number;
}

export const mapGuildConfig = (row: GuildConfigRow): GuildConfig => ({
  guildId: row.guild_id,
  channelId: row.channel_id,
  intervalMinutes: row.interval_minutes,
  enabled: row.enabled === 1,
  lastRunAt: row.last_run_at,
  lastErrorAt: row.last_error_at,
});

export const mapTrackedPlayer = (row: TrackedPlayerRow): TrackedPlayer => ({
  id: row.id,
  guildId: row.guild_id,
  accountId: row.account_id,
  steamId64: row.steam_id64,
  discordUserId: row.discord_user_id,
  displayName: row.display_name,
  addedAt: row.added_at,
});
