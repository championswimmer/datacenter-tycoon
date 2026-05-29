import type { PGlite } from "@electric-sql/pglite";
import type { SQL } from "bun";
import {
  createPgliteDrizzleClient,
  createPostgresDrizzleClient,
  type ServerPgliteDatabase,
  type ServerPostgresDatabase,
} from "./client.js";

export interface PostgresDatabaseOptions {
  mode: "postgres";
  connectionString: string;
}

export interface PgliteDatabaseOptions {
  mode: "pglite";
  dataDir?: string;
}

export type ServerDatabaseOptions = PostgresDatabaseOptions | PgliteDatabaseOptions;

export interface PostgresDatabaseConnection {
  mode: "postgres";
  client: SQL;
  db: ServerPostgresDatabase;
  close(): Promise<void>;
}

export interface PgliteDatabaseConnection {
  mode: "pglite";
  client: PGlite;
  db: ServerPgliteDatabase;
  close(): Promise<void>;
}

export type ServerDatabaseConnection =
  | PostgresDatabaseConnection
  | PgliteDatabaseConnection;

export async function createServerDatabase(
  options: ServerDatabaseOptions,
): Promise<ServerDatabaseConnection> {
  if (options.mode === "postgres") {
    const { client, db } = createPostgresDrizzleClient(options.connectionString);

    return {
      mode: "postgres",
      client,
      db,
      close: async () => {
        await client.close();
      },
    };
  }

  const { client, db } = await createPgliteDrizzleClient(options.dataDir);

  return {
    mode: "pglite",
    client,
    db,
    close: async () => {
      await client.close();
    },
  };
}
