import fs from "node:fs";
import path from "node:path";
import { deserialize } from "@datacenter-tycoon/game-logic";
import type { ParsedArgv } from "../argv.js";
import { resolveCommandPaths, writeCommandResult } from "./common.js";

export async function runLsCommand(parsed: ParsedArgv): Promise<void> {
  const subCommand = parsed.positionals[0];

  if (subCommand === "saves") {
    await listSaves(parsed);
  } else {
    throw new Error("Usage: dct ls saves");
  }
}

async function listSaves(parsed: ParsedArgv): Promise<void> {
  const paths = resolveCommandPaths(parsed);
  const dataDir = paths.dataDir;

  if (!fs.existsSync(dataDir)) {
    writeCommandResult(parsed, "No saves found (data directory does not exist).", { saves: [] });
    return;
  }

  const files = fs.readdirSync(dataDir).filter(f => f.endsWith(".json"));
  const saves = [];

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

  const table = saves.map(s => {
    return `${s.file.padEnd(40)} | Tick: ${String(s.tick).padStart(6)} | Cash: $${String(s.cash).padStart(10)} | ${s.playerName}`;
  }).join("\n");

  writeCommandResult(parsed, saves.length > 0 ? `Available Saves:\n${table}` : "No valid saves found.", { saves });
}
