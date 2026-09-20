import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { getGuildConfig, setGuildEnabled, setGuildInterval } from "../db/guilds.js";
import type { Command, CommandContext } from "./types.js";

export const configCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("config")
    .setDescription("Configura o monitoramento de partidas")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("intervalo")
        .setDescription("Define de quantos em quantos minutos buscar partidas")
        .addIntegerOption((option) =>
          option
            .setName("minutos")
            .setDescription("Intervalo em minutos")
            .setRequired(true)
            .setMinValue(5)
            .setMaxValue(1440),
        ),
    )
    .addSubcommand((sub) => sub.setName("ativar").setDescription("Liga o monitoramento automático"))
    .addSubcommand((sub) =>
      sub.setName("desativar").setDescription("Desliga o monitoramento automático"),
    )
    .addSubcommand((sub) => sub.setName("status").setDescription("Mostra a configuração atual")),

  async execute(interaction, _ctx: CommandContext): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({
        content: "Este comando só funciona em servidores.",
        ephemeral: true,
      });
      return;
    }
    const guildId = interaction.guildId;
    const sub = interaction.options.getSubcommand(true);

    if (sub === "intervalo") {
      const minutes = interaction.options.getInteger("minutos", true);
      setGuildInterval(guildId, minutes);
      await interaction.reply({
        content: `Intervalo definido para **${minutes} min**.`,
        ephemeral: true,
      });
      return;
    }

    if (sub === "ativar") {
      const config = getGuildConfig(guildId);
      if (!config?.channelId) {
        await interaction.reply({
          content: "Configure um canal primeiro com `/setup`.",
          ephemeral: true,
        });
        return;
      }
      setGuildEnabled(guildId, true);
      await interaction.reply({
        content: `Monitoramento **ativado** · intervalo de ${config.intervalMinutes} min.`,
        ephemeral: true,
      });
      return;
    }

    if (sub === "desativar") {
      setGuildEnabled(guildId, false);
      await interaction.reply({ content: "Monitoramento **desativado**.", ephemeral: true });
      return;
    }

    const config = getGuildConfig(guildId);
    if (!config) {
      await interaction.reply({
        content: "Nada configurado ainda. Rode `/setup` e `/jogador adicionar`.",
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("Configuração atual")
      .setColor(0x5865f2)
      .addFields(
        {
          name: "Canal",
          value: config.channelId ? `<#${config.channelId}>` : "não definido",
          inline: true,
        },
        { name: "Intervalo", value: `${config.intervalMinutes} min`, inline: true },
        { name: "Monitoramento", value: config.enabled ? "ativado" : "desativado", inline: true },
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
