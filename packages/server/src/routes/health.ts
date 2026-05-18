import type { ServerConfig } from "../config.js";
import type { ServerRoute } from "../server/app.js";
import { jsonResponse } from "../server/app.js";

export function createHealthRoutes(config: ServerConfig): readonly ServerRoute[] {
  return [
    {
      method: "GET",
      pathname: "/healthz",
      handler: () =>
        jsonResponse({
          status: "ok",
          environment: config.environment,
          databaseConfigured: config.databaseUrl !== undefined,
        }),
    },
    {
      method: "GET",
      pathname: "/version",
      handler: () =>
        jsonResponse({
          serverVersion: config.serverVersion,
          gameLogicVersion: config.gameLogicVersion,
        }),
    },
  ];
}
