import type { ServerRoute } from "../server/app.js";
import { jsonResponse } from "../server/app.js";

export function createHealthRoutes(): readonly ServerRoute[] {
  return [
    {
      method: "GET",
      pathname: "/healthz",
      handler: (_request, { config }) =>
        jsonResponse({
          status: "ok",
          environment: config.environment,
          databaseConfigured: config.databaseUrl !== undefined,
        }),
    },
    {
      method: "GET",
      pathname: "/version",
      handler: (_request, { config }) =>
        jsonResponse({
          serverVersion: config.serverVersion,
          gameLogicVersion: config.gameLogicVersion,
        }),
    },
  ];
}
