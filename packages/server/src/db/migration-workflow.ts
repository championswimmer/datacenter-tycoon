import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate as migrateBunSql } from "drizzle-orm/bun-sql/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import {
  createPgliteDatabaseConnection,
  createPostgresDatabaseConnection,
} from "./database.js";
import { runDatabaseMigrations } from "./migrator.js";

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
    const database = createPostgresDatabaseConnection(target.connectionString);

    try {
      const baseline = await runDatabaseMigrations({
        database,
        migrationsDir: legacyMigrationsDir,
      });

      await migrateBunSql(database.db, {
        migrationsFolder: drizzleMigrationsDir,
      });

      return {
        mode: "postgres",
        appliedBaselineMigrations: baseline.appliedMigrations,
        pendingBaselineMigrations: baseline.pendingMigrations,
        drizzleMigrationsDir,
      };
    } finally {
      await database.close();
    }
  }

  const database = await createPgliteDatabaseConnection(target.dataDir);

  try {
    const baseline = await runDatabaseMigrations({
      database,
      migrationsDir: legacyMigrationsDir,
    });

    await migratePglite(database.db, {
      migrationsFolder: drizzleMigrationsDir,
    });

    return {
      mode: "pglite",
      appliedBaselineMigrations: baseline.appliedMigrations,
      pendingBaselineMigrations: baseline.pendingMigrations,
      drizzleMigrationsDir,
    };
  } finally {
    await database.close();
  }
}

export function getLegacyMigrationsDir(): string {
  return resolve(fileURLToPath(new URL("../../migrations", import.meta.url)));
}

export function getDrizzleMigrationsDir(): string {
  return resolve(fileURLToPath(new URL("../../drizzle", import.meta.url)));
}
