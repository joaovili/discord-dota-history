const VANITY_URL = "https://steamcommunity.com/id";

/**
 * Resolves a Steam vanity name to a SteamID64 using the public community XML
 * endpoint (no API key required). Returns null if the profile cannot be found.
 */
export async function resolveVanityToSteamId64(
  vanity: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<string | null> {
  const url = `${VANITY_URL}/${encodeURIComponent(vanity)}/?xml=1`;
  const response = await fetchImpl(url);
  if (!response.ok) {
    return null;
  }
  const xml = await response.text();
  const match = xml.match(/<steamID64>(\d{17})<\/steamID64>/);
  return match?.[1] ?? null;
}
