import { SlashCommandBuilder } from "discord.js";
import type { Command, CommandContext } from "./types.js";

export const pingCommand: Command = {
  data: new SlashCommandBuilder().setName("ping").setDescription("Verifica se o bot está online"),

  async execute(interaction, ctx: CommandContext): Promise<void> {
    const latency = Math.round(ctx.client.ws.ping);
    await interaction.reply({
      content: `🏓 Pong! Estou online. Latência: **${latency}ms**.`,
      ephemeral: true,
    });
  },
};
