import type { ServerConfig } from "./config.js";
import type { LeaderboardRepository } from "./leaderboard/repository.js";
import type { PlayersRepository } from "./players/repository.js";
import type { RateLimiter } from "./rate-limit/fixed-window.js";

export interface ServerServices {
  players?: PlayersRepository;
  leaderboard?: LeaderboardRepository;
  rateLimiter?: RateLimiter;
}

export interface AppDependencies {
  config: ServerConfig;
  services: ServerServices;
}

export type ServerServicesFactory = (config: ServerConfig) => ServerServices;
