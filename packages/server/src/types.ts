import type { ServerConfig } from "./config.js";
import type { LeaderboardRepository } from "./leaderboard/repository.js";
import type { PlayersRepository } from "./players/repository.js";

export interface ServerServices {
  players?: PlayersRepository;
  leaderboard?: LeaderboardRepository;
}

export interface AppDependencies {
  config: ServerConfig;
  services: ServerServices;
}
