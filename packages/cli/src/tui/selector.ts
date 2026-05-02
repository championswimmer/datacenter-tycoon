import readline from "node:readline";
import fs from "node:fs";
import path from "node:path";
import { deserialize } from "@datacenter-tycoon/game-logic";
import { resolvePaths } from "../paths.js";

export async function selectSaveTui(): Promise<string | undefined> {
  const paths = resolvePaths();
  const dataDir = paths.dataDir;

  if (!fs.existsSync(dataDir)) {
    return undefined;
  }

  const files = fs.readdirSync(dataDir).filter(f => f.endsWith(".json"));
  if (files.length === 0) {
    return undefined;
  }

  const saves: { file: string; gameId: string; tick: number; cash: number; playerName: string }[] = [];
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(dataDir, file), "utf8");
      const state = deserialize(content);
      saves.push({
        file,
        gameId: state.gameId,
        tick: state.tick,
        cash: state.player.cash,
        playerName: state.player.name,
      });
    } catch (e) {
      // Skip invalid saves
    }
  }

  if (saves.length === 0) {
    return undefined;
  }

  // Sort by most recent (not perfect as it's just based on file name or creation date, 
  // but let's assume if they have multiple they want a list)
  
  const stdin = process.stdin;
  const stdout = process.stdout;
  const wasRaw = stdin.isRaw;
  let cursor = 0;

  const render = () => {
    stdout.write("\u001B[2J\u001B[H");
    stdout.write("Datacenter Tycoon - Select a save to load\n");
    stdout.write("========================================\n\n");
    saves.forEach((s, i) => {
      const prefix = i === cursor ? "> " : "  ";
      stdout.write(`${prefix}${s.file.padEnd(20)} | Tick: ${String(s.tick).padStart(6)} | Cash: $${String(s.cash).padStart(8)} | ${s.playerName}\n`);
    });
    stdout.write("\nUse up/down to select, Enter to load, 'n' for new game, 'q' to quit\n");
  };

  stdin.setRawMode(true);
  stdin.resume();
  readline.emitKeypressEvents(stdin);
  render();

  return new Promise<string | undefined>((resolve) => {
    const onKeypress = (value: string, key: readline.Key) => {
      if (key.name === "up") {
        cursor = Math.max(0, cursor - 1);
        render();
      } else if (key.name === "down") {
        cursor = Math.min(saves.length - 1, cursor + 1);
        render();
      } else if (key.name === "return") {
        cleanup();
        const selected = saves[cursor];
        resolve(selected?.gameId);
      } else if (key.name === "n") {
        cleanup();
        resolve(undefined);
      } else if (key.name === "q" || (key.ctrl && key.name === "c")) {
        cleanup();
        process.exit(0);
      }
    };

    const cleanup = () => {
      stdin.off("keypress", onKeypress);
      stdin.setRawMode(wasRaw);
      stdout.write("\u001B[2J\u001B[H");
    };

    stdin.on("keypress", onKeypress);
  });
}
