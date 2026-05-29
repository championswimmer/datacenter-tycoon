import type { ServerConfig } from "../config.js";
import {
  createPgliteDatabaseConnection,
  createPostgresDatabaseConnection,
} from "../db/database.js";
import { DrizzleLeaderboardRepository } from "../leaderboard/repository.js";
import { DrizzlePlayersRepository } from "../players/drizzle-repository.js";
import { InMemoryPlayersRepository } from "../players/repository.js";
import { InMemoryFixedWindowRateLimiter } from "../rate-limit/fixed-window.js";
import type { AppDependencies, ServerServices, ServerServicesFactory } from "../types.js";

/**
 * Transport boundary: route/app factories receive already-resolved dependencies and should not care
 * whether repositories came from raw pg, Drizzle, in-memory fakes, or another persistence backend.
 */
export function resolveAppDependencies(
  dependencies: AppDependencies,
  createDefaultServices: ServerServicesFactory = createDefaultServerServices,
): AppDependencies {
  return {
    ...dependencies,
    services: {
      ...createDefaultServices(dependencies.config),
      ...dependencies.services,
    },
  };
}

/**
 * Synchronous default services remain test-friendly and primarily serve createApp() callers that have
 * not opted into real runtime persistence. The Bun runtime startup path uses createRuntimeServerServices()
 * so development can default to persistent PGlite while production uses Postgres.
 */
export function createDefaultServerServices(config: ServerConfig): ServerServices {
  if (config.database.mode === "postgres" && config.database.connectionString) {
    const database = createPostgresDatabaseConnection(config.database.connectionString);

    return {
      players: new DrizzlePlayersRepository(database),
      leaderboard: new DrizzleLeaderboardRepository(database),
      rateLimiter: new InMemoryFixedWindowRateLimiter(),
    };
  }

  return {
    players: new InMemoryPlayersRepository(),
    rateLimiter: new InMemoryFixedWindowRateLimiter(),
  };
}

export async function createRuntimeServerServices(config: ServerConfig): Promise<ServerServices> {
  if (config.database.mode === "postgres" && config.database.connectionString) {
    const database = createPostgresDatabaseConnection(config.database.connectionString);

    return {
      players: new DrizzlePlayersRepository(database),
      leaderboard: new DrizzleLeaderboardRepository(database),
      rateLimiter: new InMemoryFixedWindowRateLimiter(),
    };
  }

  if (config.database.mode === "pglite" && config.database.pgliteDataDir) {
    const database = await createPgliteDatabaseConnection(config.database.pgliteDataDir);

    return {
      players: new DrizzlePlayersRepository(database),
      leaderboard: new DrizzleLeaderboardRepository(database),
      rateLimiter: new InMemoryFixedWindowRateLimiter(),
    };
  }

  return {
    players: new InMemoryPlayersRepository(),
    rateLimiter: new InMemoryFixedWindowRateLimiter(),
  };
}
