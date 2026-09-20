import { REST, Routes } from "discord.js";
import { commands } from "./index.js";

export async function registerCommands(
  token: string,
  clientId: string,
  guildId?: string,
): Promise<number> {
  const rest = new REST().setToken(token);
  const body = commands.map((command) => command.data.toJSON());

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body });
  }

  return body.length;
}
