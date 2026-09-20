import { configCommand } from "./config.js";
import { jogadorCommand } from "./jogador.js";
import { partidasCommand } from "./partidas.js";
import { setupCommand } from "./setup.js";
import type { Command } from "./types.js";

export const commands: Command[] = [setupCommand, jogadorCommand, configCommand, partidasCommand];

export const commandMap = new Map<string, Command>(
  commands.map((command) => [command.data.name, command]),
);
