import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate as migrateBunSql } from "drizzle-orm/bun-sql/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { createPgliteDrizzleClient, createPostgresDrizzleClient } from "./client.js";
import { runMigrations, runPgliteMigrations } from "./migrator.js";

export type MigrationTarget =
  | { mode: "postgres"; connectionString: string }
  | { mode: "pglite"; dataDir: string };

export interface MigrationWorkflowResult {
  mode: MigrationTarget["mode"];
  appliedBaselineMigrations: string[];
  pendingBaselineMigrations: string[];
  drizzleMigrationsDir: string;
}

export function resolveMigrationTarget(
  env: Record<string, string | undefined> = process.env,
): MigrationTarget {
  const databaseUrl = env.DATABASE_URL?.trim();

  if (databaseUrl) {
    return {
      mode: "postgres",
      connectionString: databaseUrl,
    };
  }

  const pgliteDataDir = env.PGLITE_DATA_DIR?.trim();

  if (pgliteDataDir) {
    return {
      mode: "pglite",
      dataDir: pgliteDataDir,
    };
  }

  throw new Error("Set DATABASE_URL or PGLITE_DATA_DIR before running migrations.");
}

export async function migrateConfiguredDatabase(
  env: Record<string, string | undefined> = process.env,
): Promise<MigrationWorkflowResult> {
  const target = resolveMigrationTarget(env);
  const legacyMigrationsDir = getLegacyMigrationsDir();
  const drizzleMigrationsDir = getDrizzleMigrationsDir();

  if (target.mode === "postgres") {
    const baseline = await runMigrations({
      databaseUrl: target.connectionString,
      migrationsDir: legacyMigrationsDir,
    });
    const { client, db } = createPostgresDrizzleClient(target.connectionString);

    try {
      await migrateBunSql(db, {
        migrationsFolder: drizzleMigrationsDir,
      });
    } finally {
      await client.close();
    }

    return {
      mode: "postgres",
      appliedBaselineMigrations: baseline.appliedMigrations,
      pendingBaselineMigrations: baseline.pendingMigrations,
      drizzleMigrationsDir,
    };
  }

  const { client, db } = await createPgliteDrizzleClient(target.dataDir);

  try {
    const baseline = await runPgliteMigrations({
      client,
      migrationsDir: legacyMigrationsDir,
    });

    await migratePglite(db, {
      migrationsFolder: drizzleMigrationsDir,
    });

    return {
      mode: "pglite",
      appliedBaselineMigrations: baseline.appliedMigrations,
      pendingBaselineMigrations: baseline.pendingMigrations,
      drizzleMigrationsDir,
    };
  } finally {
    await client.close();
  }
}

export function getLegacyMigrationsDir(): string {
  return resolve(fileURLToPath(new URL("../../migrations", import.meta.url)));
}

export function getDrizzleMigrationsDir(): string {
  return resolve(fileURLToPath(new URL("../../drizzle", import.meta.url)));
}
