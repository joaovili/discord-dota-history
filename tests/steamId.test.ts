import { describe, expect, it } from "vitest";
import {
  accountIdToSteamId64,
  parseProfileInput,
  steamId64ToAccountId,
} from "../src/services/steamId.js";

const SAMPLE_STEAM64 = "76561198000000000";
const SAMPLE_ACCOUNT_ID = 39734272;

describe("steamId", () => {
  it("converts account id to steamid64", () => {
    expect(accountIdToSteamId64(SAMPLE_ACCOUNT_ID)).toBe(SAMPLE_STEAM64);
  });

  it("converts steamid64 to account id", () => {
    expect(steamId64ToAccountId(SAMPLE_STEAM64)).toBe(SAMPLE_ACCOUNT_ID);
  });

  it("rejects steamid64 outside the valid range", () => {
    expect(steamId64ToAccountId("76561197960265727")).toBeNull();
    expect(steamId64ToAccountId("0")).toBeNull();
  });

  it("parses a steamid64", () => {
    expect(parseProfileInput(SAMPLE_STEAM64)).toEqual({
      kind: "steamId64",
      steamId64: SAMPLE_STEAM64,
      accountId: SAMPLE_ACCOUNT_ID,
    });
  });

  it("parses a 32-bit account id", () => {
    expect(parseProfileInput(String(SAMPLE_ACCOUNT_ID))).toEqual({
      kind: "accountId",
      accountId: SAMPLE_ACCOUNT_ID,
      steamId64: SAMPLE_STEAM64,
    });
  });

  it("parses a /profiles/ URL", () => {
    expect(parseProfileInput(`https://steamcommunity.com/profiles/${SAMPLE_STEAM64}`)?.kind).toBe(
      "steamId64",
    );
  });

  it("parses an /id/ vanity URL", () => {
    expect(parseProfileInput("https://steamcommunity.com/id/brunao/")).toEqual({
      kind: "vanity",
      vanity: "brunao",
    });
  });

  it("parses a bare vanity name", () => {
    expect(parseProfileInput("brunao")).toEqual({ kind: "vanity", vanity: "brunao" });
  });

  it("returns null for unusable input", () => {
    expect(parseProfileInput("")).toBeNull();
    expect(parseProfileInput("!!!")).toBeNull();
    expect(parseProfileInput("https://example.com/profiles/1")).toBeNull();
    expect(parseProfileInput("123456789012345678")).toBeNull();
  });
});
