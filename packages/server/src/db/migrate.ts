import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadServerConfig } from "../config.js";
import { runMigrations } from "./migrator.js";

async function main(): Promise<void> {
  const config = loadServerConfig(process.env);

  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL is required to run migrations.");
  }

  const migrationsDir = resolve(fileURLToPath(new URL("../../migrations", import.meta.url)));
  const result = await runMigrations({
    databaseUrl: config.databaseUrl,
    migrationsDir,
  });

  if (result.appliedMigrations.length === 0) {
    console.log("No pending migrations.");
    return;
  }

  console.log(`Applied migrations: ${result.appliedMigrations.join(", ")}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown migration error";
  console.error(`Migration failed: ${message}`);
  process.exitCode = 1;
});
