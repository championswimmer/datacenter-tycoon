import {
  deserialize,
  newGame,
  serialize,
} from "@datacenter-tycoon/game-logic";
import type { Difficulty, GameState } from "@datacenter-tycoon/game-logic";
import { createGameStore } from "./gameStore.js";
import type { GameStore } from "./gameStore.js";
import { attachAudioEvents } from "./audioEvents.js";

const SAVE_PREFIX = "datacenter-tycoon:save-v1";
const SAVE_INDEX_KEY = "datacenter-tycoon:save-index";
const BYTE_ENCODER = new TextEncoder();
let saveIndexCache: SaveInfo[] | null = null;
let lastSaveAudit: SaveStorageAudit | null = null;

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

export interface SaveStorageAudit {
  payloadBytes: number;
  indexBytes: number;
  totalBytes: number;
}

export interface SaveWriteOptions {
  payloadWarnBytes?: number;
  indexWarnBytes?: number;
}

export const SAVE_PAYLOAD_WARN_BYTES = 128 * 1024;
export const SAVE_INDEX_WARN_BYTES = 32 * 1024;

function cloneSaveInfo(info: SaveInfo): SaveInfo {
  return { ...info };
}

function cloneSaveIndex(index: SaveInfo[]): SaveInfo[] {
  return index.map(cloneSaveInfo);
}

function byteLength(value: string): number {
  return BYTE_ENCODER.encode(value).byteLength;
}

function buildSaveInfo(state: GameState, updatedAt = Date.now()): SaveInfo {
  return {
    gameId: state.gameId,
    tick: state.tick,
    cash: state.player.cash,
    playerName: state.player.name,
    updatedAt,
  };
}

function upsertSaveIndex(index: SaveInfo[], info: SaveInfo): SaveInfo[] {
  const nextIndex = cloneSaveIndex(index);
  const existingIndex = nextIndex.findIndex((entry) => entry.gameId === info.gameId);

  if (existingIndex >= 0) {
    nextIndex.splice(existingIndex, 1);
  }

  nextIndex.unshift(cloneSaveInfo(info));
  return nextIndex;
}

function setSaveIndexCache(index: SaveInfo[]): void {
  saveIndexCache = cloneSaveIndex(index);
}

export function invalidateSaveIndexCache(): void {
  saveIndexCache = null;
}

export function getSaveIndex(): SaveInfo[] {
  if (saveIndexCache) {
    return cloneSaveIndex(saveIndexCache);
  }

  try {
    const raw = localStorage.getItem(SAVE_INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) as SaveInfo[] : [];
    setSaveIndexCache(parsed);
    return cloneSaveIndex(parsed);
  } catch {
    setSaveIndexCache([]);
    return [];
  }
}

export function getLatestSaveInfo(): SaveInfo | null {
  return getSaveIndex()[0] ?? null;
}

export function hasAnySaves(): boolean {
  return getLatestSaveInfo() !== null;
}

function buildSaveIndexSnapshot(state: GameState, updatedAt = Date.now()): {
  index: SaveInfo[];
  latest: SaveInfo;
  indexJson: string;
  indexBytes: number;
} {
  const latest = buildSaveInfo(state, updatedAt);
  const index = upsertSaveIndex(getSaveIndex(), latest);
  const indexJson = JSON.stringify(index);

  return {
    index,
    latest,
    indexJson,
    indexBytes: byteLength(indexJson),
  };
}

export function inspectSaveStorage(state: GameState, updatedAt = Date.now()): SaveStorageAudit {
  const payloadBytes = byteLength(serialize(state));
  const { indexBytes } = buildSaveIndexSnapshot(state, updatedAt);

  return {
    payloadBytes,
    indexBytes,
    totalBytes: payloadBytes + indexBytes,
  };
}

export function getLastSaveAudit(): SaveStorageAudit | null {
  return lastSaveAudit;
}

function isQuotaExceededError(error: unknown): boolean {
  return error instanceof DOMException && (
    error.name === "QuotaExceededError"
    || error.name === "NS_ERROR_DOM_QUOTA_REACHED"
    || error.code === 22
  );
}

function warnIfSaveIsLarge(
  audit: SaveStorageAudit,
  payloadWarnBytes: number,
  indexWarnBytes: number,
): void {
  if (audit.payloadBytes > payloadWarnBytes || audit.indexBytes > indexWarnBytes) {
    console.warn(
      `[persist] Large save snapshot: payload=${audit.payloadBytes}B, index=${audit.indexBytes}B, total=${audit.totalBytes}B`,
    );
  }
}

export function getCurrentGameId(): string | null {
  return getLatestSaveInfo()?.gameId ?? null;
}

/** The number of Tick actions between automatic saves. */
export const AUTOSAVE_EVERY_TICKS = 5;
/** Debounce window for Tick-driven autosaves so writes happen off the dispatch critical path. */
export const AUTOSAVE_TICK_DEBOUNCE_MS = 150;

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
export function writeSave(
  state: GameState,
  options: SaveWriteOptions = {},
): SaveStorageAudit | null {
  const payloadWarnBytes = options.payloadWarnBytes ?? SAVE_PAYLOAD_WARN_BYTES;
  const indexWarnBytes = options.indexWarnBytes ?? SAVE_INDEX_WARN_BYTES;

  try {
    const key = getSaveKey(state.gameId);
    const payloadJson = serialize(state);
    const payloadBytes = byteLength(payloadJson);
    const { index, indexJson, indexBytes } = buildSaveIndexSnapshot(state);

    localStorage.setItem(key, payloadJson);
    localStorage.setItem(SAVE_INDEX_KEY, indexJson);
    setSaveIndexCache(index);

    lastSaveAudit = {
      payloadBytes,
      indexBytes,
      totalBytes: payloadBytes + indexBytes,
    };
    warnIfSaveIsLarge(lastSaveAudit, payloadWarnBytes, indexWarnBytes);
    return lastSaveAudit;
  } catch (err) {
    const snapshot = inspectSaveStorage(state);
    lastSaveAudit = snapshot;
    if (isQuotaExceededError(err)) {
      console.warn(
        `[persist] Failed to write save because localStorage quota was exceeded (payload=${snapshot.payloadBytes}B, index=${snapshot.indexBytes}B).`,
      );
    } else {
      console.warn("[persist] Failed to write save:", err);
    }
    return null;
  }
}

/** Remove the save from localStorage (used by "New Game"). */
export function clearSave(gameId: string): void {
  localStorage.removeItem(getSaveKey(gameId));
  const index = getSaveIndex().filter((entry) => entry.gameId !== gameId);
  localStorage.setItem(SAVE_INDEX_KEY, JSON.stringify(index));
  setSaveIndexCache(index);
}

/** Wipe all game saves and the index from localStorage. */
export function clearAllSaves(): void {
  try {
    const index = getSaveIndex();
    for (const info of index) {
      localStorage.removeItem(getSaveKey(info.gameId));
    }
    localStorage.removeItem(SAVE_INDEX_KEY);
    localStorage.removeItem("datacenter-tycoon:save-v1"); // Legacy key
    setSaveIndexCache([]);
    lastSaveAudit = null;
  } catch (err) {
    console.warn("[persist] Failed to clear all saves:", err);
  }
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
  tickDebounceMs = AUTOSAVE_TICK_DEBOUNCE_MS,
): () => void {
  let lastSavedTick = store.getState().tick;
  let pendingState: GameState | null = null;
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;

  const flushPendingSave = () => {
    if (!pendingState) {
      return;
    }

    writeSave(pendingState);
    lastSavedTick = pendingState.tick;
    pendingState = null;
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
  };

  const scheduleTickSave = (state: GameState) => {
    pendingState = state;
    if (pendingTimer) {
      clearTimeout(pendingTimer);
    }
    pendingTimer = setTimeout(() => {
      pendingTimer = null;
      flushPendingSave();
    }, tickDebounceMs);
  };

  const unsubscribe = store.subscribe(() => {
    const state = store.getState();
    const lastAction = store.getLastAction();
    const isTick = lastAction?.type === "Tick";

    if (isTick) {
      if (state.tick - lastSavedTick >= everyTicks) {
        scheduleTickSave(state);
      }
      return;
    }

    pendingState = null;
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
    writeSave(state);
    lastSavedTick = state.tick;
  });

  return () => {
    flushPendingSave();
    unsubscribe();
  };
}

// ── Bootstrap helper ───────────────────────────────────────────────────────────

export interface StoreSession {
  store: GameStore;
  stopAutosave: () => void;
  isFreshStart: boolean;
}

function createStoreSession(initial: GameState, isFreshStart: boolean): StoreSession {
  const store = createGameStore(initial);
  const stopAutosave = attachAutosave(store);
  const stopAudioEvents = attachAudioEvents(store);

  return {
    store,
    stopAutosave: () => {
      stopAutosave();
      stopAudioEvents();
    },
    isFreshStart,
  };
}

function loadSavedState(gameId?: string): GameState | null {
  if (gameId) {
    return loadSave(getSaveKey(gameId));
  }

  const latestSave = getLatestSaveInfo();
  if (latestSave) {
    return loadSave(getSaveKey(latestSave.gameId));
  }

  // Compatibility with old save key
  return loadSave("datacenter-tycoon:save-v1");
}

export interface CreateFreshSessionOptions {
  difficulty?: Difficulty;
  playerName?: string;
}

export function createFreshSession(
  options: Difficulty | CreateFreshSessionOptions = "hard",
): StoreSession {
  const resolvedOptions = typeof options === "string"
    ? { difficulty: options }
    : options;

  return createStoreSession(
    newGame(Math.floor(Math.random() * 2 ** 31), {
      difficulty: resolvedOptions.difficulty,
      playerName: resolvedOptions.playerName,
    }),
    true,
  );
}

export function createLoadedSession(gameId?: string): StoreSession | null {
  const saved = loadSavedState(gameId);
  return saved ? createStoreSession(saved, false) : null;
}

/**
 * Create (or restore) the single global GameStore:
 *  1. Try loading a saved game from localStorage.
 *  2. Fall back to a fresh game with a random seed.
 *  3. Attach autosave.
 *
 * Returns the ready-to-use store and the autosave unsubscribe fn.
 */
export function bootstrapStore(gameId?: string): StoreSession {
  return createLoadedSession(gameId) ?? createFreshSession();
}
