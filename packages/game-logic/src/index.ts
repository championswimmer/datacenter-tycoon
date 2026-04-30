// @datacenter-tycoon/game-logic
// Core game logic entrypoint. Re-export domain modules from here.

export const VERSION = "0.1.0";

export * from "./types.js";
export * from "./catalog/index.js";
export * from "./entities/index.js";
export * from "./economy/index.js";
export * from "./contracts/index.js";
export * from "./sim/index.js";
export * from "./state/index.js";
export * from "./save/index.js";
