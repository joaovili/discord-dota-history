import { registerCommands } from "./commands/register.js";
import { config } from "./config.js";

const count = await registerCommands(
  config.discordToken,
  config.discordClientId,
  config.discordGuildId,
);

console.log(
  `Registrados ${count} comando(s) ${config.discordGuildId ? `no servidor ${config.discordGuildId}` : "globalmente"}.`,
);
