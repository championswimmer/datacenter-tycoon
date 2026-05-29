import type { ServerConfig } from "../config.js";
import { createFilePgliteDrizzleClient, createPostgresDrizzleClient } from "../db/client.js";
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
    const { db } = createPostgresDrizzleClient(config.database.connectionString);

    return {
      players: new DrizzlePlayersRepository(db),
      leaderboard: new DrizzleLeaderboardRepository(db),
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
    const { db } = createPostgresDrizzleClient(config.database.connectionString);

    return {
      players: new DrizzlePlayersRepository(db),
      leaderboard: new DrizzleLeaderboardRepository(db),
      rateLimiter: new InMemoryFixedWindowRateLimiter(),
    };
  }

  if (config.database.mode === "pglite" && config.database.pgliteDataDir) {
    const { client, db } = createFilePgliteDrizzleClient(config.database.pgliteDataDir);
    await client.waitReady;

    return {
      players: new DrizzlePlayersRepository(db),
      leaderboard: new DrizzleLeaderboardRepository(db),
      rateLimiter: new InMemoryFixedWindowRateLimiter(),
    };
  }

  return {
    players: new InMemoryPlayersRepository(),
    rateLimiter: new InMemoryFixedWindowRateLimiter(),
  };
}
