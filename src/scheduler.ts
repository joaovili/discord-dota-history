import type { Client } from "discord.js";
import {
  clearGuildError,
  getGuildConfig,
  listEnabledGuilds,
  recordGuildError,
} from "./db/guilds.js";
import { type PollDeps, pollGuild } from "./jobs/pollMatches.js";
import { describeOpenDotaFailure } from "./util/format.js";

const DEFAULT_TICK_MS = 60_000;
const ERROR_COOLDOWN_MS = 60 * 60 * 1000;

export interface SchedulerOptions {
  tickMs?: number;
  onError?: (guildId: string, error: unknown) => void;
}

async function notifyGuild(client: Client, guildId: string, content: string): Promise<void> {
  const config = getGuildConfig(guildId);
  if (!config?.channelId) {
    return;
  }
  if (config.lastErrorAt && Date.now() - config.lastErrorAt < ERROR_COOLDOWN_MS) {
    return;
  }
  const channel = await client.channels.fetch(config.channelId).catch(() => null);
  if (!channel || !channel.isTextBased() || !channel.isSendable()) {
    return;
  }
  try {
    await channel.send(content);
    recordGuildError(guildId);
  } catch {
    // swallow: notification is best-effort
  }
}

export function startScheduler(deps: PollDeps, options: SchedulerOptions = {}): NodeJS.Timeout {
  const tickMs = options.tickMs ?? DEFAULT_TICK_MS;
  let running = false;

  const tick = async (): Promise<void> => {
    if (running) {
      return;
    }
    running = true;
    try {
      const now = Date.now();
      const due = listEnabledGuilds().filter(
        (guild) =>
          guild.lastRunAt === null || now - guild.lastRunAt >= guild.intervalMinutes * 60_000,
      );

      for (const guild of due) {
        try {
          const result = await pollGuild(guild.guildId, deps);
          if (result.errors.length > 0) {
            console.warn(`[scheduler] guild ${guild.guildId} erros:`, result.errors);
            await notifyGuild(deps.client, guild.guildId, describeOpenDotaFailure(result.errors));
          } else if (result.rateLimitHits > 0) {
            await notifyGuild(
              deps.client,
              guild.guildId,
              `⚠️ A OpenDota atingiu o limite de requisições (${result.rateLimitHits}x). Algumas buscas podem atrasar; tento de novo no próximo ciclo.`,
            );
          } else {
            clearGuildError(guild.guildId);
          }
          if (result.rateLimitHits > 0) {
            console.warn(
              `[scheduler] guild ${guild.guildId}: OpenDota 429 x${result.rateLimitHits}`,
            );
          }
          if (result.posted > 0) {
            console.log(
              `[scheduler] guild ${guild.guildId}: ${result.posted} partida(s) postada(s)`,
            );
          }
        } catch (error) {
          options.onError?.(guild.guildId, error);
          console.error(`[scheduler] guild ${guild.guildId} falhou:`, error);
          await notifyGuild(
            deps.client,
            guild.guildId,
            "⚠️ Falha ao atualizar o histórico de partidas. Vou tentar de novo no próximo ciclo.",
          );
        }
      }
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => {
    void tick();
  }, tickMs);
  timer.unref();
  return timer;
}
