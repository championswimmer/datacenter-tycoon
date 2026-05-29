import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { SQL } from "bun";
import { drizzle as drizzleBunSql, type BunSQLDatabase } from "drizzle-orm/bun-sql";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "./schema.js";

export type ServerDatabaseSchema = typeof schema;
export type ServerPostgresDatabase = BunSQLDatabase<ServerDatabaseSchema> & {
  $client: SQL;
};
export type ServerPgliteDatabase = PgliteDatabase<ServerDatabaseSchema> & {
  $client: PGlite;
};
export type ServerDrizzleDatabase = ServerPostgresDatabase | ServerPgliteDatabase;

export function createPostgresDrizzleClient(connectionString: string): {
  client: SQL;
  db: ServerPostgresDatabase;
} {
  const client = new SQL(connectionString);
  const db = drizzleBunSql({ client, schema });

  return {
    client,
    db,
  };
}

export function createFilePgliteDrizzleClient(dataDir: string): {
  client: PGlite;
  db: ServerPgliteDatabase;
} {
  mkdirSync(dataDir, { recursive: true });

  const client = new PGlite(dataDir);
  const db = drizzlePglite({ client, schema });

  return {
    client,
    db,
  };
}

export async function createPgliteDrizzleClient(dataDir = "memory://"): Promise<{
  client: PGlite;
  db: ServerPgliteDatabase;
}> {
  if (dataDir !== "memory://") {
    return createFilePgliteDrizzleClient(dataDir);
  }

  const client = await PGlite.create(dataDir);
  const db = drizzlePglite({ client, schema });

  return {
    client,
    db,
  };
}
