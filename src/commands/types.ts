import type {
  ChatInputCommandInteraction,
  Client,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from "discord.js";
import type { HeroIndex } from "../services/heroes.js";
import type { OpenDotaClient } from "../services/opendota.js";

export interface CommandContext {
  client: Client;
  opendota: OpenDotaClient;
  heroes: HeroIndex;
  defaultIntervalMinutes: number;
}

export interface Command {
  data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder | SlashCommandOptionsOnlyBuilder;
  execute(interaction: ChatInputCommandInteraction, ctx: CommandContext): Promise<void>;
}
