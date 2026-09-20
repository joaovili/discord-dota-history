import type { Client } from "discord.js";
import { beforeEach, describe, expect, it } from "vitest";
import { ensureGuild, getGuildConfig, setGuildChannel } from "../src/db/guilds.js";
import { createDb, setDbForTesting } from "../src/db/index.js";
import { addPlayer } from "../src/db/players.js";
import { pollGuild } from "../src/jobs/pollMatches.js";
import { HeroIndex } from "../src/services/heroes.js";
import type { MatchDetail, OpenDotaClient, PlayerMatch } from "../src/services/opendota.js";

const HEROES = [
  { id: 1, name: "Anti-Mage" },
  { id: 2, name: "Pudge" },
];

function createHeroes(): HeroIndex {
  const client = {
    getHeroes: async () =>
      HEROES.map((hero) => ({
        id: hero.id,
        name: `npc_dota_hero_${hero.name}`,
        localized_name: hero.name,
        img: `/${hero.name}.png`,
        icon: "",
      })),
  } as unknown as OpenDotaClient;
  return new HeroIndex(client);
}

function playerMatch(matchId: number, startTime: number): PlayerMatch {
  return {
    match_id: matchId,
    player_slot: 0,
    radiant_win: true,
    duration: 1800,
    game_mode: 22,
    lobby_type: 7,
    hero_id: 1,
    start_time: startTime,
    kills: 5,
    deaths: 3,
    assists: 8,
    version: null,
  };
}

function matchDetail(matchId: number, startTime: number): MatchDetail {
  const makePlayer = (slot: number) => ({
    account_id: slot === 0 ? 39734272 : 1000 + slot,
    personaname: `P${slot}`,
    name: null,
    hero_id: 1,
    player_slot: slot,
    isRadiant: slot < 128,
    win: 1,
    lose: 0,
    kills: 5,
    deaths: 3,
    assists: 8,
    gold_per_min: 500,
    xp_per_min: 600,
    net_worth: 10000,
    level: 20,
    last_hits: 100,
    denies: 3,
    rank_tier: null,
    hero_damage: 10000,
  });
  return {
    match_id: matchId,
    radiant_win: true,
    duration: 1800,
    game_mode: 22,
    lobby_type: 7,
    start_time: startTime,
    version: null,
    players: [0, 1, 2, 3, 4, 128, 129, 130, 131, 132].map(makePlayer),
  };
}

interface FakeChannelState {
  sent: Array<{ embeds: unknown[] }>;
}

function fakeClient(state: FakeChannelState): Client {
  const channel = {
    isTextBased: () => true,
    isSendable: () => true,
    send: async (payload: { embeds: unknown[] }) => {
      state.sent.push(payload);
    },
  };
  return {
    channels: { fetch: async () => channel },
  } as unknown as Client;
}

function fakeOpenDota(
  matches: PlayerMatch[],
  details: Record<number, MatchDetail>,
  failFor: number[] = [],
): OpenDotaClient {
  return {
    getHeroes: async () =>
      HEROES.map((hero) => ({
        id: hero.id,
        localized_name: hero.name,
        img: `/${hero.name}.png`,
        name: hero.name,
        icon: "",
      })),
    getPlayerMatches: async (accountId: number) => {
      if (failFor.includes(accountId)) {
        throw new Error("boom");
      }
      return matches;
    },
    getMatch: async (matchId: number) => details[matchId] ?? null,
  } as unknown as OpenDotaClient;
}

function setupGuild(): void {
  ensureGuild("g1", 30);
  setGuildChannel("g1", "c1");
}

beforeEach(() => {
  setDbForTesting(createDb(":memory:"));
});

describe("pollGuild", () => {
  it("posts new matches and marks them as seen", async () => {
    setupGuild();
    addPlayer({
      guildId: "g1",
      accountId: 39734272,
      steamId64: "76561198000000000",
      discordUserId: null,
      displayName: "A",
      addedAt: 0,
    });

    const details = { 1001: matchDetail(1001, 1000), 1002: matchDetail(1002, 2000) };
    const state: FakeChannelState = { sent: [] };
    const opendota = fakeOpenDota([playerMatch(1001, 1000), playerMatch(1002, 2000)], details);

    const result = await pollGuild("g1", {
      client: fakeClient(state),
      opendota,
      heroes: createHeroes(),
    });

    expect(result.posted).toBe(2);
    expect(state.sent).toHaveLength(2);
    expect(getGuildConfig("g1")?.lastRunAt).toBeTypeOf("number");

    const second = await pollGuild(
      "g1",
      {
        client: fakeClient({ sent: [] }),
        opendota,
        heroes: createHeroes(),
      },
      { force: true },
    );
    expect(second.candidates).toBe(2);
    expect(second.posted).toBe(0);
  });

  it("respects the limit and posts the most recent matches", async () => {
    setupGuild();
    addPlayer({
      guildId: "g1",
      accountId: 39734272,
      steamId64: "76561198000000000",
      discordUserId: null,
      displayName: "A",
      addedAt: 0,
    });

    const details = { 1001: matchDetail(1001, 1000), 1002: matchDetail(1002, 2000) };
    const state: FakeChannelState = { sent: [] };
    const opendota = fakeOpenDota([playerMatch(1001, 1000), playerMatch(1002, 2000)], details);

    const result = await pollGuild(
      "g1",
      { client: fakeClient(state), opendota, heroes: createHeroes() },
      { limit: 1 },
    );

    expect(result.posted).toBe(1);
    const embed = state.sent[0]?.embeds[0] as { data?: { url?: string } } | undefined;
    expect(embed?.data?.url).toContain("1002");
  });

  it("collects per-player errors without aborting the run", async () => {
    setupGuild();
    addPlayer({
      guildId: "g1",
      accountId: 39734272,
      steamId64: "76561198000000000",
      discordUserId: null,
      displayName: "A",
      addedAt: 0,
    });
    addPlayer({
      guildId: "g1",
      accountId: 555,
      steamId64: "76561198000000555",
      discordUserId: null,
      displayName: "B",
      addedAt: 0,
    });

    const details = { 1001: matchDetail(1001, 1000) };
    const opendota = fakeOpenDota([playerMatch(1001, 1000)], details, [39734272]);

    const result = await pollGuild("g1", {
      client: fakeClient({ sent: [] }),
      opendota,
      heroes: createHeroes(),
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("boom");
    expect(result.posted).toBe(1);
  });

  it("throws when no channel is configured", async () => {
    ensureGuild("g1", 30);
    addPlayer({
      guildId: "g1",
      accountId: 39734272,
      steamId64: "76561198000000000",
      discordUserId: null,
      displayName: "A",
      addedAt: 0,
    });

    await expect(
      pollGuild("g1", {
        client: fakeClient({ sent: [] }),
        opendota: fakeOpenDota([], {}),
        heroes: createHeroes(),
      }),
    ).rejects.toThrow(/canal/i);
  });
});
