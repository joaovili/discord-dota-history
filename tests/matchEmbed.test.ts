import { describe, expect, it } from "vitest";
import type { TrackedPlayer } from "../src/db/types.js";
import { buildMatchEmbed, isParsed } from "../src/embeds/matchEmbed.js";
import { HeroIndex } from "../src/services/heroes.js";
import type { MatchDetail, OpenDotaClient } from "../src/services/opendota.js";

const HEROES = [
  { id: 1, name: "Anti-Mage" },
  { id: 2, name: "Invoker" },
  { id: 3, name: "Pudge" },
  { id: 4, name: "Lion" },
];

function createHeroes(): HeroIndex {
  const client = {
    getHeroes: async () =>
      HEROES.map((hero) => ({
        id: hero.id,
        name: `npc_dota_hero_${hero.name}`,
        localized_name: hero.name,
        img: `/apps/dota2/images/dota_react/heroes/${hero.name}.png`,
        icon: "",
      })),
  } as unknown as OpenDotaClient;
  return new HeroIndex(client);
}

function player(
  slot: number,
  heroId: number,
  accountId: number | null,
  personaname: string | null = null,
) {
  return {
    account_id: accountId,
    personaname,
    name: null,
    hero_id: heroId,
    player_slot: slot,
    isRadiant: slot < 128,
    win: 1,
    lose: 0,
    kills: 10,
    deaths: 2,
    assists: 5,
    gold_per_min: 500,
    xp_per_min: 600,
    net_worth: 20000,
    level: 25,
    last_hits: 200,
    denies: 5,
    rank_tier: 71,
    hero_damage: 30000,
  };
}

function match(overrides: Partial<MatchDetail> = {}): MatchDetail {
  return {
    match_id: 8123456789,
    radiant_win: true,
    duration: 2537,
    game_mode: 22,
    lobby_type: 7,
    start_time: 1_700_000_000,
    version: null,
    players: [
      player(0, 1, 39734272, "Tracked One"),
      player(1, 2, 111),
      player(2, 3, 222),
      player(3, 4, 333),
      player(4, 1, 444),
      player(128, 3, 555),
      player(129, 4, 666),
      player(130, 2, 777),
      player(131, 1, null),
      player(132, 3, 888),
    ],
    ...overrides,
  };
}

function trackedPlayer(accountId: number, discordUserId = "999"): TrackedPlayer {
  return {
    id: accountId,
    guildId: "g1",
    accountId,
    steamId64: "76561198000000000",
    discordUserId,
    displayName: `Player ${accountId}`,
    addedAt: 0,
  };
}

describe("buildMatchEmbed", () => {
  it("marks tracked players and renders both teams", async () => {
    const heroes = createHeroes();
    await heroes.ensureLoaded();
    const tracked = new Map([[39734272, trackedPlayer(39734272)]]);

    const embed = buildMatchEmbed({ match: match(), heroes, tracked });
    const json = embed.toJSON();

    expect(json.title).toContain("Vitória");
    expect(json.title).toContain("42:17");
    expect(json.description).toContain("✅");
    expect(json.url).toBe("https://www.dotabuff.com/matches/8123456789");
    expect(json.fields).toHaveLength(2);
    expect(json.fields?.[0]?.name).toBe("🟢 Radiant");
    expect(json.fields?.[1]?.name).toBe("🔴 Dire");
    expect(json.fields?.[0]?.value).toContain("⭐");
    expect(json.fields?.[0]?.value).toContain("Anti-Mage");
    expect(json.fields?.[0]?.value).toContain("Tracked One");
    expect(json.fields?.[0]?.value).toContain("200/5");
    expect(json.fields?.[0]?.value).toContain("Div1");
    expect(json.fields?.[1]?.value).toContain("Pudge");
    expect(json.fields?.[1]?.value).toContain("perfil privado");
    expect(json.description).toContain("<@999>");
    expect(json.footer?.text).toContain("não parseada");
    expect(json.thumbnail?.url).toContain("Anti-Mage.png");
  });

  it("reports parsed matches and anonymous players", async () => {
    const heroes = createHeroes();
    await heroes.ensureLoaded();

    const embed = buildMatchEmbed({
      match: match({ radiant_win: false, version: 21 }),
      heroes,
      tracked: new Map(),
    });
    const dire = embed.toJSON().fields?.[1]?.value ?? "";

    expect(embed.toJSON().title).toContain("Dire venceu");
    expect(embed.toJSON().footer?.text).toContain("parseada");
    expect(dire).toContain("Anti-Mage");
    expect(embed.toJSON().thumbnail).toBeUndefined();
  });

  it("handles tracked players on opposite teams", async () => {
    const heroes = createHeroes();
    await heroes.ensureLoaded();
    const tracked = new Map([
      [39734272, trackedPlayer(39734272, "111")],
      [555, trackedPlayer(555, "222")],
    ]);

    const embed = buildMatchEmbed({ match: match(), heroes, tracked });
    const json = embed.toJSON();
    const radiant = json.fields?.[0]?.value ?? "";
    const dire = json.fields?.[1]?.value ?? "";

    expect(radiant.startsWith("```")).toBe(true);
    expect(radiant).toContain("⭐");
    expect(dire).toContain("⭐");
    expect(json.title).toContain("Vitória e derrota");
    expect(json.description).toContain("<@111>");
    expect(json.description).toContain("<@222>");
    expect(json.description).toContain("✅");
    expect(json.description).toContain("❌");
  });

  it("shows a defeat when the tracked player loses", async () => {
    const heroes = createHeroes();
    await heroes.ensureLoaded();
    const tracked = new Map([[39734272, trackedPlayer(39734272)]]);

    const embed = buildMatchEmbed({ match: match({ radiant_win: false }), heroes, tracked });
    const json = embed.toJSON();

    expect(json.title).toContain("Derrota");
    expect(json.description).toContain("❌");
  });
});

describe("isParsed", () => {
  it("treats version >= 20 as parsed", () => {
    expect(isParsed(21)).toBe(true);
    expect(isParsed(20)).toBe(true);
    expect(isParsed(19)).toBe(false);
    expect(isParsed(null)).toBe(false);
  });
});
