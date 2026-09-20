import type { OpenDotaClient } from "./opendota.js";
import { resolveVanityToSteamId64 } from "./steam.js";
import { parseProfileInput, steamId64ToAccountId } from "./steamId.js";

export interface ResolvedPlayer {
  steamId64: string;
  accountId: number;
  displayName: string;
  avatarUrl: string | null;
}

export class PlayerResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlayerResolutionError";
  }
}

export async function resolvePlayer(
  input: string,
  client: OpenDotaClient,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<ResolvedPlayer> {
  const parsed = parseProfileInput(input);
  if (!parsed) {
    throw new PlayerResolutionError(
      "Não reconheci esse perfil. Envie a URL do perfil, o SteamID64 ou o ID de conta.",
    );
  }

  let steamId64: string;
  let accountId: number;

  if (parsed.kind === "vanity") {
    const resolved = await resolveVanityToSteamId64(parsed.vanity, fetchImpl);
    if (!resolved) {
      throw new PlayerResolutionError(`Não encontrei o perfil "${parsed.vanity}" na Steam.`);
    }
    const converted = steamId64ToAccountId(resolved);
    if (converted === null) {
      throw new PlayerResolutionError("O perfil encontrado tem um SteamID64 inválido.");
    }
    steamId64 = resolved;
    accountId = converted;
  } else {
    steamId64 = parsed.steamId64;
    accountId = parsed.accountId;
  }

  const profile = await client.getPlayer(accountId);
  if (!profile?.profile || profile.profile.account_id === null) {
    throw new PlayerResolutionError(
      `Não encontrei dados de Dota 2 para a conta ${accountId}. Confira o perfil (e se o histórico é público).`,
    );
  }

  const displayName = profile.profile.personaname?.trim() || `Conta ${accountId}`;
  return {
    steamId64,
    accountId,
    displayName,
    avatarUrl: profile.profile.avatarfull ?? null,
  };
}
