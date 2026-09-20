import { Client, Events, GatewayIntentBits, MessageFlags } from "discord.js";
import { commandMap } from "./commands/index.js";
import { registerCommands } from "./commands/register.js";
import type { CommandContext } from "./commands/types.js";
import { config } from "./config.js";
import { closeDb, initDb } from "./db/index.js";
import { startScheduler } from "./scheduler.js";
import { HeroIndex } from "./services/heroes.js";
import { OpenDotaClient } from "./services/opendota.js";

initDb(config.dbPath);

const opendota = new OpenDotaClient({ apiKey: config.openDotaApiKey });
const heroes = new HeroIndex(opendota);
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const context: CommandContext = {
  client,
  opendota,
  heroes,
  defaultIntervalMinutes: config.defaultIntervalMinutes,
};

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`DDH (Discord Dota History) conectado como ${readyClient.user.tag}`);
  try {
    const count = await registerCommands(
      config.discordToken,
      config.discordClientId,
      config.discordGuildId,
    );
    console.log(`Registrados ${count} comando(s).`);
  } catch (error) {
    console.error("Falha ao registrar comandos:", error);
  }
  startScheduler({ client, opendota, heroes });
  console.log("Agendador iniciado.");
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }
  const command = commandMap.get(interaction.commandName);
  if (!command) {
    return;
  }
  try {
    await command.execute(interaction, context);
  } catch (error) {
    console.error(`Erro no comando /${interaction.commandName}:`, error);
    const payload = {
      content: "Ocorreu um erro ao executar o comando.",
      flags: MessageFlags.Ephemeral,
    } as const;
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload);
      } else {
        await interaction.reply(payload);
      }
    } catch {
      // ignore: interaction may have expired
    }
  }
});

async function shutdown(signal: string): Promise<void> {
  console.log(`\nRecebido ${signal}, encerrando...`);
  await client.destroy();
  closeDb();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await client.login(config.discordToken);
