import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "pg";

export const MIGRATIONS_TABLE = "schema_migrations";

export interface LoadedMigration {
  name: string;
  sql: string;
}

export interface RunMigrationsOptions {
  databaseUrl: string;
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

export async function runMigrations(
  options: RunMigrationsOptions,
): Promise<MigrationRunResult> {
  const migrations = await loadMigrations(options.migrationsDir);
  const client = new Client({
    connectionString: options.databaseUrl,
  });

  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const appliedNames = await getAppliedMigrationNames(client);
    const pendingMigrations = migrations
      .map((migration) => migration.name)
      .filter((name) => !appliedNames.has(name));
    const appliedMigrations: string[] = [];

    for (const migration of migrations) {
      if (appliedNames.has(migration.name)) {
        continue;
      }

      await client.query("BEGIN");

      try {
        await client.query(migration.sql);
        await client.query(
          `INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES ($1)`,
          [migration.name],
        );
        await client.query("COMMIT");
        appliedMigrations.push(migration.name);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    return {
      appliedMigrations,
      pendingMigrations,
    };
  } finally {
    await client.end();
  }
}

async function getAppliedMigrationNames(client: Client): Promise<Set<string>> {
  const result = await client.query<{ name: string }>(
    `SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY name ASC`,
  );

  return new Set(result.rows.map((row) => row.name));
}
