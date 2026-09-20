const STEAM64_BASE = 76561197960265728n;
const MAX_ACCOUNT_ID = 4294967295n;

export type ParsedProfile =
  | { kind: "steamId64"; steamId64: string; accountId: number }
  | { kind: "accountId"; accountId: number; steamId64: string }
  | { kind: "vanity"; vanity: string };

function isValidAccountId(accountId: bigint): boolean {
  return accountId >= 0n && accountId <= MAX_ACCOUNT_ID;
}

export function accountIdToSteamId64(accountId: number): string {
  return (BigInt(accountId) + STEAM64_BASE).toString();
}

export function steamId64ToAccountId(steamId64: string): number | null {
  let value: bigint;
  try {
    value = BigInt(steamId64);
  } catch {
    return null;
  }
  const accountId = value - STEAM64_BASE;
  if (!isValidAccountId(accountId)) {
    return null;
  }
  return Number(accountId);
}

/**
 * Accepts a SteamID64, a 32-bit account id, a steamcommunity.com profile URL,
 * or a bare vanity name. Returns a tagged result; vanity names still need to be
 * resolved against Steam.
 */
export function parseProfileInput(raw: string): ParsedProfile | null {
  const input = raw.trim();
  if (input.length === 0) {
    return null;
  }

  const fromSteamId64 = (steamId64: string): ParsedProfile | null => {
    const accountId = steamId64ToAccountId(steamId64);
    return accountId === null ? null : { kind: "steamId64", steamId64, accountId };
  };

  const fromAccountId = (accountId: number): ParsedProfile | null => {
    if (!isValidAccountId(BigInt(accountId))) {
      return null;
    }
    return { kind: "accountId", accountId, steamId64: accountIdToSteamId64(accountId) };
  };

  if (/^\d{17}$/.test(input)) {
    return fromSteamId64(input);
  }

  if (/^\d{1,10}$/.test(input)) {
    return fromAccountId(Number(input));
  }

  if (/^\d+$/.test(input)) {
    return null;
  }

  if (/^https?:\/\//i.test(input)) {
    let url: URL;
    try {
      url = new URL(input);
    } catch {
      return null;
    }
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    if (host !== "steamcommunity.com") {
      return null;
    }
    const segments = url.pathname.split("/").filter(Boolean);
    const [scope, value] = segments;
    if (!scope || !value) {
      return null;
    }
    if (scope === "profiles" && /^\d{17}$/.test(value)) {
      return fromSteamId64(value);
    }
    if (scope === "id") {
      return { kind: "vanity", vanity: decodeURIComponent(value) };
    }
    return null;
  }

  if (/^[a-zA-Z0-9_-]{2,64}$/.test(input)) {
    return { kind: "vanity", vanity: input };
  }

  return null;
}
