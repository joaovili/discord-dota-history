import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { ensureGuild, getGuildConfig, setGuildChannel } from "../db/guilds.js";
import type { Command, CommandContext } from "./types.js";

export const setupCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Define o canal que receberá o histórico de partidas")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((option) =>
      option
        .setName("canal")
        .setDescription("Canal de texto onde as partidas serão postadas")
        .setRequired(true),
    ),

  async execute(interaction, ctx: CommandContext): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({
        content: "Este comando só funciona em servidores.",
        ephemeral: true,
      });
      return;
    }
    const channel = interaction.options.getChannel("canal", true);

    ensureGuild(interaction.guildId, ctx.defaultIntervalMinutes);
    setGuildChannel(interaction.guildId, channel.id);

    const config = getGuildConfig(interaction.guildId);
    const status = config?.enabled ? "ativado" : "desativado";
    const interval = config?.intervalMinutes ?? ctx.defaultIntervalMinutes;

    await interaction.reply({
      content: [
        `Canal de histórico definido para <#${channel.id}>.`,
        `Intervalo atual: **${interval} min** · Monitoramento **${status}**.`,
        "Adicione amigos com `/jogador adicionar` e ligue o monitoramento com `/config ativar`.",
      ].join("\n"),
      ephemeral: true,
    });
  },
};
