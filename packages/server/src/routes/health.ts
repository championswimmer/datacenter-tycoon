import type { ServerElysiaApp } from "../server/elysia-app.js";
import type { AppDependencies } from "../types.js";

export function registerHealthRoutes(
  app: ServerElysiaApp,
  { config }: AppDependencies,
): ServerElysiaApp {
  return app
    .get("/healthz", () => ({
      status: "ok",
      environment: config.environment,
      runtime: "bun",
      framework: "elysia",
      databaseMode: config.database.mode,
      databaseProvider:
        config.database.mode === "postgres"
          ? "bun-sql"
          : config.database.pgliteDataDir
            ? "pglite-file"
            : "pglite-memory",
      databaseConfigured:
        config.database.mode === "postgres"
          ? config.database.connectionString !== undefined
          : config.database.pgliteDataDir !== undefined,
    }))
    .get("/version", () => ({
      serverVersion: config.serverVersion,
      gameLogicVersion: config.gameLogicVersion,
    }));
}
