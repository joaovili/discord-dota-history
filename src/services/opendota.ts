export interface PlayerMatch {
  match_id: number;
  player_slot: number;
  radiant_win: boolean;
  duration: number;
  game_mode: number;
  lobby_type: number;
  hero_id: number;
  start_time: number;
  kills: number;
  deaths: number;
  assists: number;
  version: number | null;
}

export interface MatchPlayer {
  account_id: number | null;
  personaname: string | null;
  name: string | null;
  hero_id: number;
  player_slot: number;
  isRadiant: boolean;
  win: number;
  lose: number;
  kills: number;
  deaths: number;
  assists: number;
  gold_per_min: number;
  xp_per_min: number;
  net_worth: number | null;
  level: number | null;
  last_hits: number | null;
  denies: number | null;
  rank_tier: number | null;
  hero_damage: number | null;
}

export interface MatchDetail {
  match_id: number;
  radiant_win: boolean;
  duration: number;
  game_mode: number;
  lobby_type: number;
  start_time: number;
  version: number | null;
  players: MatchPlayer[];
}

export interface PlayerProfile {
  profile: {
    account_id: number | null;
    personaname: string | null;
    avatarfull: string | null;
    profileurl: string | null;
    steamid: string | null;
  };
  rank_tier: number | null;
}

export interface Hero {
  id: number;
  name: string;
  localized_name: string;
  img: string;
  icon: string;
}

export interface OpenDotaClientOptions {
  apiKey?: string | undefined;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  minRequestGapMs?: number;
  maxRetries?: number;
  sleep?: (ms: number) => Promise<void>;
}

export class OpenDotaError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "OpenDotaError";
  }
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class OpenDotaClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly minRequestGapMs: number;
  private readonly maxRetries: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private queue: Promise<unknown> = Promise.resolve();
  private lastRequestAt = 0;

  constructor(options: OpenDotaClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? "https://api.opendota.com/api";
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.minRequestGapMs = options.minRequestGapMs ?? 1100;
    this.maxRetries = options.maxRetries ?? 3;
    this.sleep = options.sleep ?? defaultSleep;
  }

  getPlayer(accountId: number): Promise<PlayerProfile | null> {
    return this.request<PlayerProfile>(`/players/${accountId}`);
  }

  getPlayerMatches(accountId: number, limit = 20): Promise<PlayerMatch[]> {
    return this.request<PlayerMatch[]>(`/players/${accountId}/matches`, { limit, significant: 0 });
  }

  getMatch(matchId: number): Promise<MatchDetail | null> {
    return this.request<MatchDetail>(`/matches/${matchId}`);
  }

  getHeroes(): Promise<Hero[]> {
    return this.request<Hero[]>("/heroes");
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private request<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
    return this.enqueue(async () => {
      const url = new URL(`${this.baseUrl}${path}`);
      if (this.apiKey) {
        url.searchParams.set("api_key", this.apiKey);
      }
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, String(value));
      }

      let attempt = 0;
      for (;;) {
        await this.throttle();
        const response = await this.fetchImpl(url, { method: "GET" });
        this.lastRequestAt = Date.now();

        if (response.status === 404) {
          return null as T;
        }

        if (response.status === 429 || response.status >= 500) {
          if (attempt >= this.maxRetries) {
            throw new OpenDotaError(`OpenDota request failed: ${response.status}`, response.status);
          }
          attempt += 1;
          await this.sleep(this.retryDelay(response, attempt));
          continue;
        }

        if (!response.ok) {
          throw new OpenDotaError(
            `OpenDota request failed: ${response.status} ${response.statusText}`,
            response.status,
          );
        }

        return (await response.json()) as T;
      }
    });
  }

  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    const wait = this.minRequestGapMs - elapsed;
    if (wait > 0) {
      await this.sleep(wait);
    }
  }

  private retryDelay(response: Response, attempt: number): number {
    const retryAfter = response.headers.get("retry-after");
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds) && seconds > 0) {
        return seconds * 1000;
      }
    }
    return Math.min(30_000, 2 ** attempt * 1000);
  }
}
