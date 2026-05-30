import { fileURLToPath } from "node:url";
import { ConfigError, getServerDatabaseRuntimeInfo, loadServerConfig } from "./config.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerLeaderboardRoutes } from "./routes/leaderboard.js";
import { registerPlayerRoutes } from "./routes/players.js";
import type { ServerElysiaApp } from "./server/elysia-app.js";
import { createElysiaServerApp } from "./server/elysia-app.js";
import {
  createDefaultServerServices,
  createRuntimeServerServices,
  resolveAppDependencies,
} from "./server/dependencies.js";
import type { AppDependencies, ServerServicesFactory } from "./types.js";

export function createApp(
  dependencies: AppDependencies,
  createServices: ServerServicesFactory = createDefaultServerServices,
): ServerElysiaApp {
  const context = resolveAppDependencies(dependencies, createServices);

  return createElysiaServerApp({
    context,
    register: (app, registeredContext) =>
      registerLeaderboardRoutes(
        registerPlayerRoutes(registerHealthRoutes(app, registeredContext), registeredContext),
        registeredContext,
      ),
  });
}

export async function startServer(
  env: Record<string, string | undefined> = process.env,
): Promise<ServerElysiaApp> {
  const config = loadServerConfig(env);
  const services = await createRuntimeServerServices(config);
  const app = createApp({
    config,
    services,
  });

  app.listen(
    {
      hostname: config.host,
      port: config.port,
    },
    (server) => {
      const database = getServerDatabaseRuntimeInfo(config);
      console.log(
        `Datacenter Tycoon server listening on ${config.host}:${server.port} (runtime=bun, framework=elysia, db=${database.mode}/${database.provider}, game-logic v${config.gameLogicVersion})`,
      );
    },
  );

  return app;
}

if (isDirectExecution(import.meta.url)) {
  void startServer().catch((error) => {
    const message = error instanceof Error ? error.message : "Unknown startup error";
    const prefix = error instanceof ConfigError ? "Invalid server configuration" : "Server failed to start";
    console.error(`${prefix}: ${message}`);
    process.exitCode = 1;
  });
}

function isDirectExecution(moduleUrl: string): boolean {
  const entrypoint = process.argv[1];

  return entrypoint !== undefined && fileURLToPath(moduleUrl) === entrypoint;
}
