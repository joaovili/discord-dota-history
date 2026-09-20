import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { addPlayer, getPlayersByDiscordId, listPlayers, removePlayer } from "../db/players.js";
import { PlayerResolutionError, resolvePlayer } from "../services/resolvePlayer.js";
import { resolveVanityToSteamId64 } from "../services/steam.js";
import { parseProfileInput, steamId64ToAccountId } from "../services/steamId.js";
import type { Command, CommandContext } from "./types.js";

async function accountIdFromInput(input: string): Promise<number | null> {
  const parsed = parseProfileInput(input);
  if (!parsed) {
    return null;
  }
  if (parsed.kind === "vanity") {
    const steamId64 = await resolveVanityToSteamId64(parsed.vanity);
    return steamId64 ? steamId64ToAccountId(steamId64) : null;
  }
  return parsed.accountId;
}

export const jogadorCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("jogador")
    .setDescription("Gerencia os amigos monitorados")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("adicionar")
        .setDescription("Adiciona um amigo para monitorar")
        .addStringOption((option) =>
          option
            .setName("perfil")
            .setDescription("URL do perfil Steam, SteamID64 ou ID de conta")
            .setRequired(true),
        )
        .addUserOption((option) =>
          option.setName("usuario").setDescription("Mencionar o amigo no histórico"),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remover")
        .setDescription("Remove um amigo do monitoramento")
        .addStringOption((option) =>
          option.setName("perfil").setDescription("URL do perfil Steam, SteamID64 ou ID de conta"),
        )
        .addUserOption((option) =>
          option.setName("usuario").setDescription("Remover pelo usuário do Discord vinculado"),
        ),
    )
    .addSubcommand((sub) => sub.setName("listar").setDescription("Lista os amigos monitorados")),

  async execute(interaction, ctx: CommandContext): Promise<void> {
    if (!interaction.guildId) {
      await interaction.reply({
        content: "Este comando só funciona em servidores.",
        ephemeral: true,
      });
      return;
    }
    const guildId = interaction.guildId;
    const sub = interaction.options.getSubcommand(true);

    if (sub === "adicionar") {
      const perfil = interaction.options.getString("perfil", true);
      const user = interaction.options.getUser("usuario");
      await interaction.deferReply({ ephemeral: true });
      try {
        const resolved = await resolvePlayer(perfil, ctx.opendota);
        addPlayer({
          guildId,
          accountId: resolved.accountId,
          steamId64: resolved.steamId64,
          discordUserId: user?.id ?? null,
          displayName: resolved.displayName,
        });
        await interaction.editReply({
          content: [
            `Monitorando **${resolved.displayName}** ${user ? `(${user})` : ""}.`,
            `Conta: \`${resolved.accountId}\` · SteamID64: \`${resolved.steamId64}\``,
            "Partidas a partir de agora serão postadas no canal configurado.",
          ].join("\n"),
        });
      } catch (error) {
        const message =
          error instanceof PlayerResolutionError
            ? error.message
            : "Falha ao consultar o perfil. Tente novamente em instantes.";
        await interaction.editReply({ content: message });
      }
      return;
    }

    if (sub === "remover") {
      const perfil = interaction.options.getString("perfil");
      const user = interaction.options.getUser("usuario");
      if (!perfil && !user) {
        await interaction.reply({
          content: "Informe `perfil` ou `usuario` para remover.",
          ephemeral: true,
        });
        return;
      }
      await interaction.deferReply({ ephemeral: true });

      const removed: string[] = [];
      if (user) {
        for (const player of getPlayersByDiscordId(guildId, user.id)) {
          removePlayer(guildId, player.accountId);
          removed.push(player.displayName);
        }
      }
      if (perfil) {
        const accountId = await accountIdFromInput(perfil);
        if (accountId === null) {
          await interaction.editReply({ content: "Não reconheci esse perfil." });
          return;
        }
        if (removePlayer(guildId, accountId) > 0) {
          removed.push(`conta ${accountId}`);
        }
      }

      await interaction.editReply({
        content:
          removed.length > 0
            ? `Removido(s): ${removed.join(", ")}.`
            : "Nenhum jogador correspondente encontrado.",
      });
      return;
    }

    const players = listPlayers(guildId);
    if (players.length === 0) {
      await interaction.reply({
        content: "Nenhum amigo monitorado. Use `/jogador adicionar`.",
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`Jogadores monitorados (${players.length})`)
      .setColor(0x5865f2)
      .setDescription(
        players
          .map((player) => {
            const mention = player.discordUserId ? `<@${player.discordUserId}>` : "sem usuário";
            return `**${player.displayName}** · ${mention} · \`${player.accountId}\``;
          })
          .join("\n"),
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
