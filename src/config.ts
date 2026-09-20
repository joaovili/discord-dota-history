import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, "DISCORD_TOKEN is required"),
  DISCORD_CLIENT_ID: z.string().min(1, "DISCORD_CLIENT_ID is required"),
  DISCORD_GUILD_ID: z.string().min(1).optional(),
  OPENDOTA_API_KEY: z.string().min(1).optional(),
  DB_PATH: z.string().min(1).default("./data/bot.sqlite"),
  DEFAULT_INTERVAL_MINUTES: z.coerce.number().int().min(1).max(1440).default(30),
});

const cleanedEnv = Object.fromEntries(
  Object.entries(process.env).map(([key, value]) => [key, value === "" ? undefined : value]),
);

const parsed = envSchema.safeParse(cleanedEnv);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

export const config = {
  discordToken: parsed.data.DISCORD_TOKEN,
  discordClientId: parsed.data.DISCORD_CLIENT_ID,
  discordGuildId: parsed.data.DISCORD_GUILD_ID,
  openDotaApiKey: parsed.data.OPENDOTA_API_KEY,
  dbPath: parsed.data.DB_PATH,
  defaultIntervalMinutes: parsed.data.DEFAULT_INTERVAL_MINUTES,
} as const;

export type Config = typeof config;
