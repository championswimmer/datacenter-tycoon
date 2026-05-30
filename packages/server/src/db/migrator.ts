import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createPostgresDatabaseConnection, type ServerDatabaseAdapter } from "./database.js";

export const MIGRATIONS_TABLE = "schema_migrations";

export interface LoadedMigration {
  name: string;
  sql: string;
}

export interface RunMigrationsOptions {
  databaseUrl: string;
  migrationsDir: string;
}

export interface RunDatabaseMigrationsOptions {
  database: Pick<ServerDatabaseAdapter, "query" | "exec" | "transaction">;
  migrationsDir: string;
}

export interface MigrationRunResult {
  appliedMigrations: string[];
  pendingMigrations: string[];
}

export async function loadMigrations(migrationsDir: string): Promise<LoadedMigration[]> {
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  const migrationNames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  return Promise.all(
    migrationNames.map(async (name) => ({
      name,
      sql: await readFile(join(migrationsDir, name), "utf8"),
    })),
  );
}

export async function runDatabaseMigrations(
  options: RunDatabaseMigrationsOptions,
): Promise<MigrationRunResult> {
  const migrations = await loadMigrations(options.migrationsDir);

  await ensureMigrationsTable(options.database);

  const appliedNames = await getAppliedMigrationNames(options.database);
  const pendingMigrations = migrations
    .map((migration) => migration.name)
    .filter((name) => !appliedNames.has(name));
  const appliedMigrations: string[] = [];

  for (const migration of migrations) {
    if (appliedNames.has(migration.name)) {
      continue;
    }

    await options.database.transaction(async (database) => {
      await database.exec(migration.sql);
      await database.query(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES ($1)`, [migration.name]);
    });
    appliedMigrations.push(migration.name);
  }

  return {
    appliedMigrations,
    pendingMigrations,
  };
}

export async function runMigrations(
  options: RunMigrationsOptions,
): Promise<MigrationRunResult> {
  const database = createPostgresDatabaseConnection(options.databaseUrl);

  try {
    return await runDatabaseMigrations({
      database,
      migrationsDir: options.migrationsDir,
    });
  } finally {
    await database.close();
  }
}

async function ensureMigrationsTable(
  database: Pick<ServerDatabaseAdapter, "exec">,
): Promise<void> {
  await database.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrationNames(
  database: Pick<ServerDatabaseAdapter, "query">,
): Promise<Set<string>> {
  const result = await database.query<{ name: string }>(
    `SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY name ASC`,
  );

  return new Set(result.rows.map((row) => row.name));
}
