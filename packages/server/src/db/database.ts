import type { PGlite } from "@electric-sql/pglite";
import type { SQL } from "bun";
import {
  createPgliteDrizzleClient,
  createPgliteDrizzleDatabase,
  createPostgresDrizzleClient,
  createPostgresDrizzleDatabase,
  type ServerDrizzleDatabase,
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

export interface ServerDatabaseQueryResult<TRow> {
  rows: TRow[];
}

export interface ServerDatabaseAdapter<
  TMode extends ServerDatabaseOptions["mode"] = ServerDatabaseOptions["mode"],
  TDatabase extends ServerDrizzleDatabase = ServerDrizzleDatabase,
> {
  mode: TMode;
  db: TDatabase;
  query<TRow extends Record<string, unknown> = Record<string, unknown>>(
    sqlText: string,
    params?: readonly unknown[],
  ): Promise<ServerDatabaseQueryResult<TRow>>;
  exec(sqlText: string): Promise<void>;
  transaction<TResult>(
    callback: (database: ServerDatabaseAdapter<TMode, TDatabase>) => Promise<TResult>,
  ): Promise<TResult>;
  close(): Promise<void>;
}

export interface PostgresDatabaseConnection
  extends ServerDatabaseAdapter<"postgres", ServerPostgresDatabase> {
  client: SQL;
}

export interface PgliteDatabaseConnection
  extends ServerDatabaseAdapter<"pglite", ServerPgliteDatabase> {
  client: PGlite;
}

export type ServerDatabaseConnection =
  | PostgresDatabaseConnection
  | PgliteDatabaseConnection;

export function createPostgresDatabaseConnection(
  connectionString: string,
): PostgresDatabaseConnection {
  const { client, db } = createPostgresDrizzleClient(connectionString);
  return wrapPostgresDatabase(client, db, async () => {
    await client.close();
  });
}

export async function createPgliteDatabaseConnection(
  dataDir?: string,
): Promise<PgliteDatabaseConnection> {
  const { client, db } = await createPgliteDrizzleClient(dataDir);
  return wrapPgliteDatabase(client, db, async () => {
    await client.close();
  });
}

export async function createServerDatabase(
  options: ServerDatabaseOptions,
): Promise<ServerDatabaseConnection> {
  if (options.mode === "postgres") {
    return createPostgresDatabaseConnection(options.connectionString);
  }

  return createPgliteDatabaseConnection(options.dataDir);
}

function wrapPostgresDatabase(
  client: SQL,
  db: ServerPostgresDatabase,
  close: () => Promise<void>,
): PostgresDatabaseConnection {
  return {
    mode: "postgres",
    client,
    db,
    query: async <TRow extends Record<string, unknown> = Record<string, unknown>>(
      sqlText: string,
      params?: readonly unknown[],
    ) => {
      const rows = await client.unsafe<TRow[]>(sqlText, normalizeParams(params));
      return { rows };
    },
    exec: async (sqlText: string) => {
      await client.unsafe(sqlText).simple();
    },
    transaction: async <TResult>(
      callback: (database: PostgresDatabaseConnection) => Promise<TResult>,
    ) =>
      client.begin(async (transactionClient) =>
        callback(
          wrapPostgresDatabase(
            transactionClient,
            createPostgresDrizzleDatabase(transactionClient),
            async () => {},
          ),
        ),
      ),
    close,
  };
}

function wrapPgliteDatabase(
  client: PGlite,
  db: ServerPgliteDatabase,
  close: () => Promise<void>,
): PgliteDatabaseConnection {
  return {
    mode: "pglite",
    client,
    db,
    query: async <TRow extends Record<string, unknown> = Record<string, unknown>>(
      sqlText: string,
      params?: readonly unknown[],
    ) => {
      const result = await client.query<TRow>(sqlText, normalizeParams(params));
      return { rows: result.rows };
    },
    exec: async (sqlText: string) => {
      await client.exec(sqlText);
    },
    transaction: async <TResult>(
      callback: (database: PgliteDatabaseConnection) => Promise<TResult>,
    ) => {
      await client.exec("BEGIN");

      try {
        const result = await callback(wrapPgliteDatabase(client, db, async () => {}));
        await client.exec("COMMIT");
        return result;
      } catch (error) {
        await client.exec("ROLLBACK");
        throw error;
      }
    },
    close,
  };
}

function normalizeParams(params?: readonly unknown[]): unknown[] | undefined {
  if (!params || params.length === 0) {
    return undefined;
  }

  return [...params];
}
