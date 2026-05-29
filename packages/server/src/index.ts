import { fileURLToPath } from "node:url";
import { ConfigError, loadServerConfig } from "./config.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerLeaderboardRoutes } from "./routes/leaderboard.js";
import { registerPlayerRoutes } from "./routes/players.js";
import { createElysiaServerApp } from "./server/elysia-app.js";
import {
  createDefaultServerServices,
  resolveAppDependencies,
} from "./server/dependencies.js";
import { createNodeHttpServer } from "./server/node-http.js";
import type { AppDependencies, ServerServicesFactory } from "./types.js";

export function createApp(
  dependencies: AppDependencies,
  createServices: ServerServicesFactory = createDefaultServerServices,
) {
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

export function startServer(
  env: Record<string, string | undefined> = process.env,
): ReturnType<typeof createNodeHttpServer> {
  const config = loadServerConfig(env);
  const app = createApp({
    config,
    services: {},
  });
  const server = createNodeHttpServer(app);

  server.listen(config.port, config.host, () => {
    console.log(
      `Datacenter Tycoon server listening on ${config.host}:${config.port} (game-logic v${config.gameLogicVersion})`,
    );
  });

  return server;
}

if (isDirectExecution(import.meta.url)) {
  try {
    startServer();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown startup error";
    const prefix = error instanceof ConfigError ? "Invalid server configuration" : "Server failed to start";
    console.error(`${prefix}: ${message}`);
    process.exitCode = 1;
  }
}

function isDirectExecution(moduleUrl: string): boolean {
  const entrypoint = process.argv[1];

  return entrypoint !== undefined && fileURLToPath(moduleUrl) === entrypoint;
}

