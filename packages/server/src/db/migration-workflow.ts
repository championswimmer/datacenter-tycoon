import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadServerConfig, type ServerConfig, type ServerDatabaseProvider } from "../config.js";
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
  provider: Exclude<ServerDatabaseProvider, "pglite-memory">;
  appliedBaselineMigrations: string[];
  pendingBaselineMigrations: string[];
  drizzleMigrationsDir: string;
}

export function resolveMigrationTargetFromConfig(
  config: Pick<ServerConfig, "database">,
): MigrationTarget {
  if (config.database.mode === "postgres" && config.database.connectionString) {
    return {
      mode: "postgres",
      connectionString: config.database.connectionString,
    };
  }

  if (config.database.mode === "pglite" && config.database.pgliteDataDir) {
    return {
      mode: "pglite",
      dataDir: config.database.pgliteDataDir,
    };
  }

  throw new Error("Resolved server config did not expose a migratable database target.");
}

export function resolveMigrationTarget(
  env: Record<string, string | undefined> = process.env,
): MigrationTarget {
  return resolveMigrationTargetFromConfig(loadServerConfig(env));
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
        provider: "bun-sql",
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
      provider: "pglite-file",
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
