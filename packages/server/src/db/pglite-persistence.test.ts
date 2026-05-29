import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "bun:test";
import { createServerDatabase } from "./database.js";
import { migrateConfiguredDatabase } from "./migration-workflow.js";
import { DrizzlePlayersRepository } from "../players/drizzle-repository.js";

test("file-backed PGlite persists player data across reopen cycles", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "dct-pglite-persist-"));

  try {
    await migrateConfiguredDatabase({
      PGLITE_DATA_DIR: dataDir,
    });

    const firstDatabase = await createServerDatabase({
      mode: "pglite",
      dataDir,
    });

    if (firstDatabase.mode !== "pglite") {
      throw new Error("Expected PGlite database instance.");
    }

    const firstPlayers = new DrizzlePlayersRepository(firstDatabase.db);
    const created = await firstPlayers.createPlayer({ username: "Persistent Cloud" });
    await firstDatabase.close();

    const reopenedDatabase = await createServerDatabase({
      mode: "pglite",
      dataDir,
    });

    if (reopenedDatabase.mode !== "pglite") {
      throw new Error("Expected PGlite database instance.");
    }

    const reopenedPlayers = new DrizzlePlayersRepository(reopenedDatabase.db);
    const persisted = await reopenedPlayers.findByPlayerId(created.playerId);

    assert.equal(persisted?.username, "Persistent Cloud");

    await reopenedDatabase.close();
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});
