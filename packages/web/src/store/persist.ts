import {
  deserialize,
  newGame,
  serialize,
} from "@datacenter-tycoon/game-logic";
import type { GameState } from "@datacenter-tycoon/game-logic";
import { createGameStore } from "./gameStore.js";
import type { GameStore } from "./gameStore.js";
import { attachAudioEvents } from "./audioEvents.js";

const SAVE_PREFIX = "datacenter-tycoon:save-v1";
const SAVE_INDEX_KEY = "datacenter-tycoon:save-index";

export function getSaveKey(gameId: string): string {
  return `${SAVE_PREFIX}:${gameId}`;
}

export interface SaveInfo {
  gameId: string;
  tick: number;
  cash: number;
  playerName: string;
  updatedAt: number;
}

export function getSaveIndex(): SaveInfo[] {
  try {
    const raw = localStorage.getItem(SAVE_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function updateSaveIndex(state: GameState): void {
  const index = getSaveIndex();
  const existingIndex = index.findIndex(s => s.gameId === state.gameId);
  const info: SaveInfo = {
    gameId: state.gameId,
    tick: state.tick,
    cash: state.player.cash,
    playerName: state.player.name,
    updatedAt: Date.now(),
  };

  if (existingIndex >= 0) {
    const item = index[existingIndex];
    if (item) {
        item.tick = info.tick;
        item.cash = info.cash;
        item.playerName = info.playerName;
        item.updatedAt = info.updatedAt;
        // Move to top
        index.splice(existingIndex, 1);
        index.unshift(item);
    }
  } else {
    index.unshift(info);
  }

  localStorage.setItem(SAVE_INDEX_KEY, JSON.stringify(index));
}

export function getCurrentGameId(): string | null {
  const index = getSaveIndex();
  const first = index[0];
  return first ? first.gameId : null;
}

/** The number of Tick actions between automatic saves. */
export const AUTOSAVE_EVERY_TICKS = 5;

// ── Low-level read / write ─────────────────────────────────────────────────────

/** Load a GameState from localStorage. Returns null on miss or corrupt save. */
export function loadSave(keyOrGameId: string): GameState | null {
  try {
    const key = keyOrGameId.includes(":") ? keyOrGameId : getSaveKey(keyOrGameId);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return deserialize(raw);
  } catch (err) {
    console.warn("[persist] Failed to load save — starting fresh:", err);
    return null;
  }
}

/** Persist a GameState snapshot to localStorage. Silently swallows quota errors. */
export function writeSave(state: GameState): void {
  try {
    const key = getSaveKey(state.gameId);
    localStorage.setItem(key, serialize(state));
    updateSaveIndex(state);
  } catch (err) {
    console.warn("[persist] Failed to write save:", err);
  }
}

/** Remove the save from localStorage (used by "New Game"). */
export function clearSave(gameId: string): void {
  localStorage.removeItem(getSaveKey(gameId));
  const index = getSaveIndex().filter(s => s.gameId !== gameId);
  localStorage.setItem(SAVE_INDEX_KEY, JSON.stringify(index));
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
  everyTicks = AUTOSAVE_EVERY_TICKS,
): () => void {
  let lastSavedTick = store.getState().tick;

  return store.subscribe(() => {
    const state = store.getState();
    const isTick = state.tick > lastSavedTick;

    if (isTick) {
      if (state.tick - lastSavedTick >= everyTicks) {
        writeSave(state);
        lastSavedTick = state.tick;
      }
    } else {
      // Non-tick action (PlaceRack, AcceptContract, etc.) — save now
      writeSave(state);
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
export function bootstrapStore(gameId?: string): {
  store: GameStore;
  stopAutosave: () => void;
  isFreshStart: boolean;
} {
  let saved: GameState | null = null;
  
  if (gameId) {
    saved = loadSave(getSaveKey(gameId));
  } else {
    // Try to load the most recent save if none specified
    const index = getSaveIndex();
    if (index.length > 0 && index[0]) {
      saved = loadSave(getSaveKey(index[0].gameId));
    } else {
      // Compatibility with old save key
      saved = loadSave("datacenter-tycoon:save-v1");
    }
  }

  const isFreshStart = saved === null;
  const initial = saved ?? newGame(Math.floor(Math.random() * 2 ** 31));

  const store = createGameStore(initial);
  const stopAutosave = attachAutosave(store);
  const stopAudioEvents = attachAudioEvents(store);

  return { 
    store, 
    stopAutosave: () => {
      stopAutosave();
      stopAudioEvents();
    }, 
    isFreshStart 
  };
}
