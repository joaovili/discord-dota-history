import type { Hero, OpenDotaClient } from "./opendota.js";

const STEAM_CDN = "https://cdn.cloudflare.steamstatic.com";
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export class HeroIndex {
  private byId = new Map<number, Hero>();
  private loadedAt = 0;
  private inflight: Promise<void> | null = null;

  constructor(
    private readonly client: OpenDotaClient,
    private readonly ttlMs = DEFAULT_TTL_MS,
  ) {}

  async ensureLoaded(): Promise<void> {
    if (this.byId.size > 0 && Date.now() - this.loadedAt < this.ttlMs) {
      return;
    }
    if (this.inflight) {
      return this.inflight;
    }
    this.inflight = this.load();
    try {
      await this.inflight;
    } finally {
      this.inflight = null;
    }
  }

  private async load(): Promise<void> {
    const heroes = await this.client.getHeroes();
    const next = new Map<number, Hero>();
    for (const hero of heroes) {
      next.set(hero.id, hero);
    }
    this.byId = next;
    this.loadedAt = Date.now();
  }

  name(heroId: number): string {
    return this.byId.get(heroId)?.localized_name ?? `Herói #${heroId}`;
  }

  imageUrl(heroId: number): string | null {
    const img = this.byId.get(heroId)?.img;
    if (!img) {
      return null;
    }
    return img.startsWith("http") ? img : `${STEAM_CDN}${img}`;
  }
}
