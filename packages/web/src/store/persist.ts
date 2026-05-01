import {
  deserialize,
  newGame,
  serialize,
} from "@datacenter-tycoon/game-logic";
import type { GameState } from "@datacenter-tycoon/game-logic";
import { createGameStore } from "./gameStore.js";
import type { GameStore } from "./gameStore.js";

const SAVE_KEY = "datacenter-tycoon:save-v1";

/** The number of Tick actions between automatic saves. */
export const AUTOSAVE_EVERY_TICKS = 5;

// ── Low-level read / write ─────────────────────────────────────────────────────

/** Load a GameState from localStorage. Returns null on miss or corrupt save. */
export function loadSave(key = SAVE_KEY): GameState | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return deserialize(raw);
  } catch (err) {
    console.warn("[persist] Failed to load save — starting fresh:", err);
    return null;
  }
}

/** Persist a GameState snapshot to localStorage. Silently swallows quota errors. */
export function writeSave(state: GameState, key = SAVE_KEY): void {
  try {
    localStorage.setItem(key, serialize(state));
  } catch (err) {
    console.warn("[persist] Failed to write save:", err);
  }
}

/** Remove the save from localStorage (used by "New Game"). */
export function clearSave(key = SAVE_KEY): void {
  localStorage.removeItem(key);
}

// ── Autosave subscription ──────────────────────────────────────────────────────

/**
 * Attach an autosave subscription to a GameStore.
 *
 * Rules:
 *  - Every non-Tick dispatch (capex, contracts, etc.) → save immediately.
 *  - Tick dispatches → save every AUTOSAVE_EVERY_TICKS ticks.
 *
 * Returns the unsubscribe function (stops autosaving; call on unmount/new-game).
 */
export function attachAutosave(
  store: GameStore,
  key = SAVE_KEY,
  everyTicks = AUTOSAVE_EVERY_TICKS,
): () => void {
  let lastSavedTick = store.getState().tick;

  return store.subscribe(() => {
    const state = store.getState();
    const isTick = state.tick > lastSavedTick;

    if (isTick) {
      if (state.tick - lastSavedTick >= everyTicks) {
        writeSave(state, key);
        lastSavedTick = state.tick;
      }
    } else {
      // Non-tick action (PlaceRack, AcceptContract, etc.) — save now
      writeSave(state, key);
      lastSavedTick = state.tick;
    }
  });
}

// ── Bootstrap helper ───────────────────────────────────────────────────────────

/**
 * Create (or restore) the single global GameStore:
 *  1. Try loading a saved game from localStorage.
 *  2. Fall back to a fresh game with a random seed.
 *  3. Attach autosave.
 *
 * Returns the ready-to-use store and the autosave unsubscribe fn.
 */
export function bootstrapStore(key = SAVE_KEY): {
  store: GameStore;
  stopAutosave: () => void;
  isFreshStart: boolean;
} {
  const saved = loadSave(key);
  const isFreshStart = saved === null;
  const initial = saved ?? newGame(Math.floor(Math.random() * 2 ** 31));

  const store = createGameStore(initial);
  const stopAutosave = attachAutosave(store, key);

  return { store, stopAutosave, isFreshStart };
}
