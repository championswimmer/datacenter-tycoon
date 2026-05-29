import type { ServerConfig } from "../config.js";
import { createPostgresDrizzleClient } from "../db/client.js";
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

  const { db } = createPostgresDrizzleClient(config.databaseUrl);

  return {
    players: new DrizzlePlayersRepository(db),
    leaderboard: new DrizzleLeaderboardRepository(db),
    rateLimiter: new InMemoryFixedWindowRateLimiter(),
  };
}
