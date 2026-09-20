import { SlashCommandBuilder } from "discord.js";
import {
  ChannelNotConfiguredError,
  ChannelUnreachableError,
  pollGuild,
} from "../jobs/pollMatches.js";
import type { Command, CommandContext } from "./types.js";

export const partidasCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("partidas")
    .setDescription("Busca partidas novas agora e posta no canal de histórico")
    .addIntegerOption((option) =>
      option
        .setName("horas")
        .setDescription("Buscar partidas das últimas N horas (padrão: desde a última busca)")
        .setMinValue(1)
        .setMaxValue(168),
    )
    .addIntegerOption((option) =>
      option
        .setName("limite")
        .setDescription("Máximo de partidas a postar (padrão 5)")
        .setMinValue(1)
        .setMaxValue(20),
    )
    .addBooleanOption((option) =>
      option
        .setName("repostar")
        .setDescription("Repostar partidas já enviadas antes (padrão: não)"),
    ),

  async execute(interaction, ctx: CommandContext): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({
        content: "Este comando só funciona em servidores.",
        ephemeral: true,
      });
      return;
    }

    const hours = interaction.options.getInteger("horas");
    const limit = interaction.options.getInteger("limite") ?? 5;
    const repostar = interaction.options.getBoolean("repostar") ?? false;
    const sinceMs = hours !== null ? Date.now() - hours * 3_600_000 : undefined;

    await interaction.deferReply({ ephemeral: true });

    try {
      const result = await pollGuild(
        interaction.guildId,
        { client: ctx.client, opendota: ctx.opendota, heroes: ctx.heroes },
        { force: true, ignoreSeen: repostar, limit, sinceMs },
      );

      const lines = [`**${result.posted}** partida(s) postada(s) no canal.`];
      if (result.candidates === 0) {
        lines.push("Nenhuma partida nova encontrada no período.");
      }
      if (result.skipped > 0) {
        lines.push(`${result.skipped} partida(s) sem dados disponíveis foram ignoradas.`);
      }
      if (result.errors.length > 0) {
        lines.push(`Avisos:\n${result.errors.map((e) => `• ${e}`).join("\n")}`);
      }
      await interaction.editReply({ content: lines.join("\n") });
    } catch (error) {
      const message =
        error instanceof ChannelNotConfiguredError || error instanceof ChannelUnreachableError
          ? error.message
          : "Falha ao buscar partidas. Veja os logs do bot.";
      await interaction.editReply({ content: message });
    }
  },
};
