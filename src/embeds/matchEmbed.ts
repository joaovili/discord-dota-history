import { EmbedBuilder } from "discord.js";
import type { TrackedPlayer } from "../db/types.js";
import type { HeroIndex } from "../services/heroes.js";
import { formatDuration } from "../util/format.js";

const GAME_MODES: Record<number, string> = {
  1: "All Pick",
  2: "Captains Mode",
  3: "Random Draft",
  4: "Single Draft",
  5: "All Random",
  11: "Mid Only",
  12: "Least Played",
  16: "Captains Draft",
  18: "Ability Draft",
  20: "All Random Deathmatch",
  22: "All Pick",
  23: "Turbo",
};

const LOBBY_TYPES: Record<number, string> = {
  0: "Normal",
  1: "Practice",
  2: "Tournament",
  4: "Co-op vs Bots",
  5: "Team Match",
  6: "Solo Queue",
  7: "Ranked",
  9: "Battle Cup",
};

const HERO_NAME_WIDTH = 19;
const NICK_WIDTH = 19;
const RANK_WIDTH = 4;
const KDA_WIDTH = 8;
const FARM_WIDTH = 8;
const INDENT = "   ";
const RADIANT_COLOR = 0x57d05b;
const DIRE_COLOR = 0xd64545;
const MIXED_COLOR = 0x99aab5;

const RANK_MEDALS = ["", "Her", "Gua", "Cru", "Arc", "Leg", "Anc", "Div", "Imm"];

export interface MatchEmbedInput {
  match: {
    match_id: number;
    radiant_win: boolean;
    duration: number;
    game_mode: number;
    lobby_type: number;
    start_time: number;
    version: number | null;
    players: Array<{
      account_id: number | null;
      personaname: string | null;
      hero_id: number;
      player_slot: number;
      isRadiant?: boolean;
      kills: number;
      deaths: number;
      assists: number;
      last_hits: number | null;
      denies: number | null;
      rank_tier: number | null;
    }>;
  };
  heroes: HeroIndex;
  tracked: Map<number, TrackedPlayer>;
}

export function isParsed(version: number | null): boolean {
  return typeof version === "number" && version >= 20;
}

function modeLabel(mode: number): string {
  return GAME_MODES[mode] ?? `Modo ${mode}`;
}

function lobbyLabel(lobby: number): string {
  return LOBBY_TYPES[lobby] ?? `Lobby ${lobby}`;
}

function isRadiantPlayer(player: { isRadiant?: boolean; player_slot: number }): boolean {
  return player.isRadiant ?? player.player_slot < 128;
}

function marker(tracked: boolean): string {
  return tracked ? "⭐ " : "   ";
}

function clip(value: string, width: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= width) {
    return trimmed.padEnd(width, " ");
  }
  return `${trimmed.slice(0, width - 1)}…`;
}

function rankLabel(rankTier: number | null | undefined): string {
  if (!rankTier || rankTier < 1) {
    return "—";
  }
  const medal = RANK_MEDALS[Math.floor(rankTier / 10)];
  if (!medal) {
    return "—";
  }
  const star = rankTier % 10;
  return star > 0 ? `${medal}${star}` : medal;
}

function playerLines(
  player: MatchEmbedInput["match"]["players"][number],
  heroes: HeroIndex,
): [string, string] {
  const hero = clip(heroes.name(player.hero_id), HERO_NAME_WIDTH);
  const nick = clip(player.personaname ?? "perfil privado", NICK_WIDTH);
  const rank = clip(rankLabel(player.rank_tier), RANK_WIDTH);
  const kda = `${player.kills}/${player.deaths}/${player.assists}`.padEnd(KDA_WIDTH, " ");
  const farm = `${player.last_hits ?? 0}/${player.denies ?? 0}`.padEnd(FARM_WIDTH, " ");
  return [`${hero} ${kda} ${rank}`.trimEnd(), `${nick} ${farm}`.trimEnd()];
}

function teamBlock(
  players: MatchEmbedInput["match"]["players"],
  heroes: HeroIndex,
  tracked: Map<number, TrackedPlayer>,
): string {
  const blocks = players.map((player) => {
    const isTracked = player.account_id !== null && tracked.has(player.account_id);
    const [first, second] = playerLines(player, heroes);
    return `${marker(isTracked)}${first}\n${INDENT}${second}`;
  });
  return ["```", blocks.join("\n\n"), "```"].join("\n");
}

function mention(player: TrackedPlayer): string {
  return player.discordUserId ? `<@${player.discordUserId}>` : player.displayName;
}

export function buildMatchEmbed(input: MatchEmbedInput): EmbedBuilder {
  const { match, heroes, tracked } = input;
  const radiant = match.players.filter((p) => isRadiantPlayer(p));
  const dire = match.players.filter((p) => !isRadiantPlayer(p));
  const winner = match.radiant_win ? "Radiant" : "Dire";

  const trackedInMatch = match.players
    .filter((p) => p.account_id !== null && tracked.has(p.account_id))
    .map((p) => {
      const player = tracked.get(p.account_id as number) as TrackedPlayer;
      return {
        player,
        hero: heroes.name(p.hero_id),
        won: isRadiantPlayer(p) === match.radiant_win,
      };
    });

  const results = trackedInMatch.map((entry) => entry.won);
  const allWon = results.length > 0 && results.every(Boolean);
  const allLost = results.length > 0 && results.every((won) => !won);
  const mixed = results.length > 0 && !allWon && !allLost;

  const title = allWon
    ? `✅ Vitória · ${formatDuration(match.duration)}`
    : allLost
      ? `❌ Derrota · ${formatDuration(match.duration)}`
      : mixed
        ? `⚖️ Vitória e derrota · ${formatDuration(match.duration)}`
        : `${match.radiant_win ? "🟢" : "🔴"} ${winner} venceu · ${formatDuration(match.duration)}`;

  const color = allWon
    ? RADIANT_COLOR
    : allLost
      ? DIRE_COLOR
      : mixed
        ? MIXED_COLOR
        : match.radiant_win
          ? RADIANT_COLOR
          : DIRE_COLOR;

  const descriptionLines = [`${modeLabel(match.game_mode)} · ${lobbyLabel(match.lobby_type)}`];
  if (trackedInMatch.length > 0) {
    descriptionLines.push(
      `Rastreados: ${trackedInMatch
        .map((entry) => `${mention(entry.player)} (${entry.hero}) ${entry.won ? "✅" : "❌"}`)
        .join(", ")}`,
    );
  }

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setURL(`https://www.dotabuff.com/matches/${match.match_id}`)
    .setColor(color)
    .setDescription(descriptionLines.join("\n"))
    .setTimestamp(new Date(match.start_time * 1000))
    .setFooter({
      text: `Match ${match.match_id} · ${lobbyLabel(match.lobby_type)} · ${
        isParsed(match.version) ? "parseada ✅" : "não parseada ⚠️"
      }`,
    });

  if (radiant.length > 0) {
    embed.addFields({
      name: "🟢 Radiant",
      value: teamBlock(radiant, heroes, tracked),
      inline: false,
    });
  }
  if (dire.length > 0) {
    embed.addFields({
      name: "🔴 Dire",
      value: teamBlock(dire, heroes, tracked),
      inline: false,
    });
  }

  const thumbnail = match.players
    .filter((p) => p.account_id !== null && tracked.has(p.account_id))
    .map((p) => heroes.imageUrl(p.hero_id))
    .find((url): url is string => url !== null);
  if (thumbnail) {
    embed.setThumbnail(thumbnail);
  }

  return embed;
}
