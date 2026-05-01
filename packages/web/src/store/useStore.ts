import { useSyncExternalStore, useCallback } from "react";
import type { Action, GameState } from "@datacenter-tycoon/game-logic";
import type { GameStore } from "./gameStore.js";

/**
 * Returns a snapshot of the full GameState, re-rendering every time
 * the store is updated. Powered by React 18's `useSyncExternalStore`.
 *
 * Prefer `useGameSelector` (via storeContext) for derived data — it avoids
 * re-rendering when only unrelated parts of the state change.
 */
export function useGameState(store: GameStore): GameState {
  return useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState, // server snapshot (SSR / hydration)
  );
}

/**
 * Returns a stable `dispatch` function bound to the store.
 * The reference never changes for the same store instance.
 */
export function useDispatch(store: GameStore): (action: Action) => void {
  return useCallback((action: Action) => store.dispatch(action), [store]);
}

/**
 * Derives data from the current state using `selector`.
 * The component only re-renders when the selector's return value changes
 * (by `Object.is` comparison — pass stable selector functions).
 *
 * @example
 *   const cash = useGameSelector(store, selectCash);
 */
export function useGameSelector<T>(
  store: GameStore,
  selector: (state: GameState) => T,
): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}
