import { readFile } from "node:fs/promises";
import { createServerDatabase } from "./database.js";

export async function createMigratedPgliteDatabase() {
  const database = await createServerDatabase({
    mode: "pglite",
    dataDir: "memory://",
  });

  if (database.mode !== "pglite") {
    throw new Error("Expected a PGlite database for test setup.");
  }

  const migrationSql = await readFile(
    new URL("../../migrations/001_leaderboard_foundation.sql", import.meta.url),
    "utf8",
  );

  await database.client.exec(migrationSql);
  return database;
}
