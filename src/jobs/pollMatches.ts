import type { Client } from "discord.js";
import { getGuildConfig, setGuildLastRun } from "../db/guilds.js";
import { getSeenMatchIds, markMatchesSeen } from "../db/matches.js";
import { listPlayers } from "../db/players.js";
import type { TrackedPlayer } from "../db/types.js";
import { buildMatchEmbed } from "../embeds/matchEmbed.js";
import type { HeroIndex } from "../services/heroes.js";
import type { OpenDotaClient } from "../services/opendota.js";

export interface PollDeps {
  client: Client;
  opendota: OpenDotaClient;
  heroes: HeroIndex;
}

export interface PollOptions {
  force?: boolean;
  ignoreSeen?: boolean;
  limit?: number;
  sinceMs?: number | undefined;
}

export interface PollResult {
  guildId: string;
  candidates: number;
  posted: number;
  skipped: number;
  rateLimitHits: number;
  errors: string[];
}

export class ChannelNotConfiguredError extends Error {
  constructor() {
    super("Canal de histórico não configurado. Rode /setup primeiro.");
    this.name = "ChannelNotConfiguredError";
  }
}

export class ChannelUnreachableError extends Error {
  constructor(channelId: string) {
    super(`Não consegui enviar para o canal <#${channelId}>. Verifique as permissões do bot.`);
    this.name = "ChannelUnreachableError";
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function pollGuild(
  guildId: string,
  deps: PollDeps,
  options: PollOptions = {},
): Promise<PollResult> {
  const result: PollResult = {
    guildId,
    candidates: 0,
    posted: 0,
    skipped: 0,
    rateLimitHits: 0,
    errors: [],
  };

  const config = getGuildConfig(guildId);
  if (!config?.channelId) {
    throw new ChannelNotConfiguredError();
  }

  const players = listPlayers(guildId);
  if (players.length === 0) {
    return result;
  }

  const channel = await deps.client.channels.fetch(config.channelId).catch(() => null);
  if (!channel || !channel.isTextBased() || !channel.isSendable()) {
    throw new ChannelUnreachableError(config.channelId);
  }

  await deps.heroes.ensureLoaded();

  const tracked = new Map<number, TrackedPlayer>();
  for (const player of players) {
    tracked.set(player.accountId, player);
  }

  const candidates = new Map<number, number>();
  for (const player of players) {
    try {
      const matches = await deps.opendota.getPlayerMatches(player.accountId);
      const floor =
        options.sinceMs ?? (options.force ? 0 : Math.max(config.lastRunAt ?? 0, player.addedAt));
      for (const match of matches) {
        if (match.start_time * 1000 >= floor) {
          candidates.set(match.match_id, match.start_time);
        }
      }
    } catch (error) {
      result.errors.push(`${player.displayName}: ${errorMessage(error)}`);
    }
  }

  let matchIds = [...candidates.keys()];
  result.candidates = matchIds.length;

  if (!options.ignoreSeen && matchIds.length > 0) {
    const seen = getSeenMatchIds(guildId, matchIds);
    matchIds = matchIds.filter((id) => !seen.has(id));
  }

  matchIds.sort((a, b) => (candidates.get(a) ?? 0) - (candidates.get(b) ?? 0));
  if (options.limit !== undefined && matchIds.length > options.limit) {
    matchIds = matchIds.slice(-options.limit);
  }

  for (const matchId of matchIds) {
    try {
      const detail = await deps.opendota.getMatch(matchId);
      if (!detail || !Array.isArray(detail.players) || detail.players.length === 0) {
        result.skipped += 1;
        continue;
      }
      const embed = buildMatchEmbed({ match: detail, heroes: deps.heroes, tracked });
      await channel.send({ embeds: [embed] });
      result.posted += 1;
    } catch (error) {
      result.errors.push(`Partida ${matchId}: ${errorMessage(error)}`);
    }
  }

  result.rateLimitHits = deps.opendota.consumeRateLimitHits?.() ?? 0;
  markMatchesSeen(guildId, matchIds);
  setGuildLastRun(guildId, Date.now());

  return result;
}
