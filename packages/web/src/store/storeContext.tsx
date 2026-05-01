import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type { Action, GameState } from "@datacenter-tycoon/game-logic";
import type { GameStore } from "./gameStore.js";
import { useGameState, useDispatch, useGameSelector } from "./useStore.js";
import type { Speed } from "./tickDriver.js";
import { setTickFraction } from "./tickFractionStore.js";
import { startTickDriver } from "./tickDriver.js";

// ── Context ────────────────────────────────────────────────────────────────────

const StoreContext = createContext<GameStore | null>(null);

function useStore(): GameStore {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error("useStore must be called inside a <StoreProvider>.");
  }
  return store;
}

// ── Provider ───────────────────────────────────────────────────────────────────

export interface StoreProviderProps {
  store: GameStore;
  children: ReactNode;
}

export function StoreProvider({ store, children }: StoreProviderProps) {
  return (
    <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
  );
}

// ── Public hooks ───────────────────────────────────────────────────────────────

/** Full GameState snapshot — re-renders on every dispatch. */
export function useFullGameState(): GameState {
  return useGameState(useStore());
}

/** Stable dispatch function — reference never changes for the same store. */
export function useGameDispatch(): (action: Action) => void {
  return useDispatch(useStore());
}

/**
 * Derived selector hook — re-renders only when the selector output changes.
 *
 * @example
 *   const cash = useSelector(selectCash);
 *   const dc   = useSelector((s) => selectDatacenter(s, dcId));
 */
export function useSelector<T>(selector: (state: GameState) => T): T {
  return useGameSelector(useStore(), selector);
}

// ── Tick driver hook ───────────────────────────────────────────────────────────

/**
 * Starts the rAF-based tick driver and tears it down on unmount.
 * Call this once from the root component (e.g. App).
 *
 * @param getSpeed - stable getter for the current speed (wrap in useCallback/useRef)
 */
export function useTickDriver(getSpeed: () => Speed): void {
  const store = useStore();
  const getSpeedRef = useRef(getSpeed);
  getSpeedRef.current = getSpeed;

  useEffect(() => {
    const stop = startTickDriver(
      (action) => store.dispatch(action),
      () => getSpeedRef.current(),
      setTickFraction,
    );
    return stop;
  }, [store]);
}
