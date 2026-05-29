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
      databaseConfigured: config.databaseUrl !== undefined,
    }))
    .get("/version", () => ({
      serverVersion: config.serverVersion,
      gameLogicVersion: config.gameLogicVersion,
    }));
}
