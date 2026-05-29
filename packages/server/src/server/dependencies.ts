import { Pool } from "pg";
import type { ServerConfig } from "../config.js";
import { PostgresLeaderboardRepository } from "../leaderboard/repository.js";
import { PostgresPlayersRepository } from "../players/postgres-repository.js";
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
 * Persistence boundary: startup chooses how repositories are constructed. This is the seam that will
 * swap from raw pg implementations to Drizzle-backed providers without changing route/service signatures.
 */
export function createDefaultServerServices(config: ServerConfig): ServerServices {
  if (!config.databaseUrl) {
    return {
      players: new InMemoryPlayersRepository(),
      rateLimiter: new InMemoryFixedWindowRateLimiter(),
    };
  }

  const pool = new Pool({
    connectionString: config.databaseUrl,
  });

  return {
    players: new PostgresPlayersRepository(pool),
    leaderboard: new PostgresLeaderboardRepository(pool),
    rateLimiter: new InMemoryFixedWindowRateLimiter(),
  };
}
