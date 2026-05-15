// @datacenter-tycoon/game-logic
// Core game logic entrypoint. Re-export domain modules from here.

export const VERSION = "0.1.0";

// Includes rack activity/power summary types.
export * from "./types.js";
// Includes power billing helpers (idle baseline + kW→kWh monthly conversion).
export * from "./balance/index.js";
export * from "./catalog/index.js";
export * from "./entities/index.js";
export * from "./economy/index.js";
export * from "./contracts/index.js";
export * from "./query/index.js";
export * from "./sim/index.js";
export * from "./state/index.js";
export * from "./save/index.js";
export * from "./algorithms/index.js";
