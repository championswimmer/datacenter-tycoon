import type { ServerConfig } from "./config.js";
import type { PlayersRepository } from "./players/repository.js";

export interface ServerServices {
  players?: PlayersRepository;
  leaderboard?: unknown;
}

export interface AppDependencies {
  config: ServerConfig;
  services: ServerServices;
}
