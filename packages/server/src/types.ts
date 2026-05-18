import type { ServerConfig } from "./config.js";

export interface ServerServices {
  players?: unknown;
  leaderboard?: unknown;
}

export interface AppDependencies {
  config: ServerConfig;
  services: ServerServices;
}
