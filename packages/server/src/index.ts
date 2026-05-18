import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { ConfigError, type ServerConfig, loadServerConfig } from "./config.js";
import { PostgresLeaderboardRepository } from "./leaderboard/repository.js";
import { PostgresPlayersRepository } from "./players/postgres-repository.js";
import { InMemoryPlayersRepository } from "./players/repository.js";
import { createHealthRoutes } from "./routes/health.js";
import { createLeaderboardRoutes } from "./routes/leaderboard.js";
import { createPlayerRoutes } from "./routes/players.js";
import { createServerApp } from "./server/app.js";
import { createNodeHttpServer } from "./server/node-http.js";
import type { AppDependencies, ServerServices } from "./types.js";

export function createApp(dependencies: AppDependencies) {
  const defaultServices = createDefaultServices(dependencies.config);

  return createServerApp({
    context: {
      ...dependencies,
      services: {
        ...defaultServices,
        ...dependencies.services,
      },
    },
    routes: [
      ...createHealthRoutes(),
      ...createPlayerRoutes(),
      ...createLeaderboardRoutes(),
    ],
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

function createDefaultServices(config: ServerConfig): ServerServices {
  if (!config.databaseUrl) {
    return {
      players: new InMemoryPlayersRepository(),
    };
  }

  const pool = new Pool({
    connectionString: config.databaseUrl,
  });

  return {
    players: new PostgresPlayersRepository(pool),
    leaderboard: new PostgresLeaderboardRepository(pool),
  };
}
