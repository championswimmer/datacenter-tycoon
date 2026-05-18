import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMigrations } from "./migrator.js";

async function main(): Promise<void> {
  const migrationsDir = resolve(fileURLToPath(new URL("../../migrations", import.meta.url)));
  const migrations = await loadMigrations(migrationsDir);

  if (migrations.length === 0) {
    throw new Error("No SQL migrations were found under packages/server/migrations.");
  }

  for (const migration of migrations) {
    if (!/^\d{3}_.+\.sql$/u.test(migration.name)) {
      throw new Error(
        `Migration ${migration.name} must use the NNN_description.sql naming convention.`,
      );
    }

    if (migration.sql.trim().length === 0) {
      throw new Error(`Migration ${migration.name} is empty.`);
    }
  }

  console.log(`Validated ${migrations.length} migration file(s).`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown migration validation error";
  console.error(`Migration validation failed: ${message}`);
  process.exitCode = 1;
});
