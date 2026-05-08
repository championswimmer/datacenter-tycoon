// Store core
export { createGameStore } from "./gameStore.js";
export type { GameStore } from "./gameStore.js";

// Tick driver
export { startTickDriver, SPEED_INTERVALS_MS } from "./tickDriver.js";
export type { Speed, RafFn, CafFn } from "./tickDriver.js";

// Selectors
export {
  selectTick,
  selectCash,
  selectPlayerName,
  selectAllDatacenters,
  selectDatacenter,
  selectActiveContracts,
  selectMarket,
  selectLedger,
  selectCapacity,
  selectDatacenterRackActivityViews,
  selectDatacenterRackPowerSummary,
  selectOpexBreakdown,
  selectRackPowerSummary,
  selectResourceUsage,
  selectMonthlyPnl,
  selectFreeCapacity,
  selectAudioEnabled,
} from "./selectors.js";
export type {
  AggregateCapacity,
  AggregateOpex,
  AggregateRackPowerSummary,
  AggregateResourceUsage,
  MonthlyPnl,
} from "./selectors.js";

// ID factories
export { nextDcId, nextRackPlacementId } from "./ids.js";

// Persistence
export {
  loadSave,
  writeSave,
  clearSave,
  attachAutosave,
  bootstrapStore,
  AUTOSAVE_EVERY_TICKS,
} from "./persist.js";

// React hooks (low-level)
export { useGameState, useDispatch, useGameSelector } from "./useStore.js";

// React context / provider / hooks (high-level)
export {
  StoreProvider,
  useFullGameState,
  useGameDispatch,
  useSelector,
  useTickDriver,
} from "./storeContext.js";
