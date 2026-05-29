import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { getDrizzleMigrationsDir, getLegacyMigrationsDir } from "./migration-workflow.js";
import { loadMigrations } from "./migrator.js";

async function main(): Promise<void> {
  const migrationsDir = getLegacyMigrationsDir();
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

  const drizzleDir = getDrizzleMigrationsDir();
  const journalPath = `${drizzleDir}/meta/_journal.json`;

  if (!existsSync(journalPath)) {
    throw new Error(`Drizzle migration journal is missing: ${journalPath}`);
  }

  const journal = JSON.parse(await readFile(journalPath, "utf8")) as {
    version?: string;
    dialect?: string;
    entries?: unknown[];
  };

  if (journal.dialect !== "postgresql") {
    throw new Error(`Drizzle migration journal must declare dialect=postgresql.`);
  }

  if (!Array.isArray(journal.entries)) {
    throw new Error(`Drizzle migration journal must contain an entries array.`);
  }

  console.log(
    `Validated ${migrations.length} legacy SQL migration file(s) and Drizzle journal at ${journalPath}.`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown migration validation error";
  console.error(`Migration validation failed: ${message}`);
  process.exitCode = 1;
});
