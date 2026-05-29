import { getServerDatabaseRuntimeInfo } from "../config.js";
import type { ServerElysiaApp } from "../server/elysia-app.js";
import type { AppDependencies } from "../types.js";

export function registerHealthRoutes(
  app: ServerElysiaApp,
  { config }: AppDependencies,
): ServerElysiaApp {
  const database = getServerDatabaseRuntimeInfo(config);

  return app
    .get("/healthz", () => ({
      status: "ok",
      environment: config.environment,
      runtime: "bun",
      framework: "elysia",
      databaseMode: database.mode,
      databaseProvider: database.provider,
      databaseConfigured: database.configured,
    }))
    .get("/version", () => ({
      serverVersion: config.serverVersion,
      gameLogicVersion: config.gameLogicVersion,
    }));
}
