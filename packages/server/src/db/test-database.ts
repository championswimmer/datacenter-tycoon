import { createServerDatabase } from "./database.js";
import { getLegacyMigrationsDir } from "./migration-workflow.js";
import { runDatabaseMigrations } from "./migrator.js";

export async function createMigratedPgliteDatabase() {
  const database = await createServerDatabase({
    mode: "pglite",
    dataDir: "memory://",
  });

  if (database.mode !== "pglite") {
    throw new Error("Expected a PGlite database for test setup.");
  }

  await runDatabaseMigrations({
    database,
    migrationsDir: getLegacyMigrationsDir(),
  });

  return database;
}
