import { useSyncExternalStore, useCallback, useRef } from "react";
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
 *
 * `useSyncExternalStore` requires that `getSnapshot` returns a STABLE
 * reference when the underlying store hasn't changed, otherwise React
 * enters an infinite re-render loop. We satisfy that contract by caching
 * the result keyed on the `GameState` object reference — game-logic's
 * reducer always produces a new state object on every dispatch, so stale
 * values are never served after a real state change.
 *
 * @example
 *   const cash = useGameSelector(store, selectCash);
 *   const dc   = useGameSelector(store, s => selectDatacenter(s, dcId));
 */
export function useGameSelector<T>(
  store: GameStore,
  selector: (state: GameState) => T,
): T {
  // Keep the latest selector in a ref so getSnapshot (memoized below) always
  // calls the current selector without needing to be recreated each render.
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  // Cache: { state, value } — recomputed only when the state object changes.
  const cache = useRef<{ state: GameState; value: T } | null>(null);

  // getSnapshot is stable (recreated only if `store` changes, which never
  // happens in practice since we use a singleton store).
  const getSnapshot = useCallback(() => {
    const state = store.getState();
    if (!cache.current || cache.current.state !== state) {
      cache.current = { state, value: selectorRef.current(state) };
    }
    return cache.current.value;
  }, [store]);

  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}
