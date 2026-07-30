import {
  deserialize,
  newGame,
  serialize,
} from "@datacenter-tycoon/game-logic";
import type { Difficulty, GameState } from "@datacenter-tycoon/game-logic";
import {
  appendVerificationAction,
  createInitialVerifiedRunState,
  createLegacyLocalOnlyVerifiedRunState,
  createVerifiedRunController,
  restoreVerifiedRunState,
  type WebVerifiedRunController,
  type WebVerifiedRunState,
} from "../online/verified-run.js";
import { createGameStore } from "./gameStore.js";
import type { GameStore } from "./gameStore.js";
import { attachAudioEvents } from "./audioEvents.js";

const SAVE_PREFIX = "datacenter-tycoon:save-v1";
const SAVE_INDEX_KEY = "datacenter-tycoon:save-index";
const APP_SAVE_VERSION = 1;
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

export interface SaveData {
  state: GameState;
  verification: WebVerifiedRunState | null;
}

interface AppSaveEnvelope {
  appSaveVersion: number;
  save: unknown;
  verification?: WebVerifiedRunState;
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

function isAppSaveEnvelope(value: unknown): value is AppSaveEnvelope {
  return Boolean(value)
    && typeof value === "object"
    && typeof (value as { appSaveVersion?: unknown }).appSaveVersion === "number"
    && "save" in (value as Record<string, unknown>);
}

function serializeSaveData(data: SaveData): string {
  const save = JSON.parse(serialize(data.state)) as unknown;
  return JSON.stringify({
    appSaveVersion: APP_SAVE_VERSION,
    save,
    verification: data.verification ?? undefined,
  } satisfies AppSaveEnvelope);
}

function deserializeSaveData(raw: string): SaveData {
  const parsed = JSON.parse(raw) as unknown;

  if (isAppSaveEnvelope(parsed)) {
    return {
      state: deserialize(JSON.stringify(parsed.save)),
      verification: parsed.verification ? restoreVerifiedRunState(parsed.verification) : null,
    };
  }

  return {
    state: deserialize(raw),
    verification: null,
  };
}

export function inspectSaveStorage(
  state: GameState,
  verification: WebVerifiedRunState | null = null,
  updatedAt = Date.now(),
): SaveStorageAudit {
  const payloadBytes = byteLength(serializeSaveData({ state, verification }));
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

export const AUTOSAVE_EVERY_TICKS = 5;
export const AUTOSAVE_TICK_DEBOUNCE_MS = 150;

export function loadSaveData(keyOrGameId: string): SaveData | null {
  try {
    const key = keyOrGameId.includes(":") ? keyOrGameId : getSaveKey(keyOrGameId);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return deserializeSaveData(raw);
  } catch (err) {
    console.warn("[persist] Failed to load save — starting fresh:", err);
    return null;
  }
}

export function loadSave(keyOrGameId: string): GameState | null {
  return loadSaveData(keyOrGameId)?.state ?? null;
}

export function writeSaveData(
  data: SaveData,
  options: SaveWriteOptions = {},
): SaveStorageAudit | null {
  const payloadWarnBytes = options.payloadWarnBytes ?? SAVE_PAYLOAD_WARN_BYTES;
  const indexWarnBytes = options.indexWarnBytes ?? SAVE_INDEX_WARN_BYTES;

  try {
    const key = getSaveKey(data.state.gameId);
    const payloadJson = serializeSaveData(data);
    const payloadBytes = byteLength(payloadJson);
    const { index, indexJson, indexBytes } = buildSaveIndexSnapshot(data.state);

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
    const snapshot = inspectSaveStorage(data.state, data.verification);
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

export function writeSave(
  state: GameState,
  options: SaveWriteOptions = {},
  verification: WebVerifiedRunState | null = null,
): SaveStorageAudit | null {
  return writeSaveData({ state, verification }, options);
}

export function clearSave(gameId: string): void {
  localStorage.removeItem(getSaveKey(gameId));
  const index = getSaveIndex().filter((entry) => entry.gameId !== gameId);
  localStorage.setItem(SAVE_INDEX_KEY, JSON.stringify(index));
  setSaveIndexCache(index);
}

export function clearAllSaves(): void {
  try {
    const index = getSaveIndex();
    for (const info of index) {
      localStorage.removeItem(getSaveKey(info.gameId));
    }
    localStorage.removeItem(SAVE_INDEX_KEY);
    localStorage.removeItem("datacenter-tycoon:save-v1");
    setSaveIndexCache([]);
    lastSaveAudit = null;
  } catch (err) {
    console.warn("[persist] Failed to clear all saves:", err);
  }
}

export function attachAutosave(
  store: GameStore,
  verificationOrEveryTicks: WebVerifiedRunController | number = createVerifiedRunController(
    createLegacyLocalOnlyVerifiedRunState(store.getState()),
  ),
  everyTicksOrDebounceMs = AUTOSAVE_EVERY_TICKS,
  tickDebounceMs = AUTOSAVE_TICK_DEBOUNCE_MS,
): () => void {
  const verification = typeof verificationOrEveryTicks === "number"
    ? createVerifiedRunController(createLegacyLocalOnlyVerifiedRunState(store.getState()))
    : verificationOrEveryTicks;
  const everyTicks = typeof verificationOrEveryTicks === "number"
    ? verificationOrEveryTicks
    : everyTicksOrDebounceMs;
  const resolvedTickDebounceMs = typeof verificationOrEveryTicks === "number"
    ? everyTicksOrDebounceMs
    : tickDebounceMs;
  let lastSavedTick = store.getState().tick;
  let pendingState: GameState | null = null;
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;

  const flushPendingSave = () => {
    if (!pendingState) {
      return;
    }

    writeSaveData({ state: pendingState, verification: verification.getState() });
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
    }, resolvedTickDebounceMs);
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
    writeSaveData({ state, verification: verification.getState() });
    lastSavedTick = state.tick;
  });

  return () => {
    flushPendingSave();
    unsubscribe();
  };
}

export interface StoreSession {
  store: GameStore;
  verification: WebVerifiedRunController;
  stopAutosave: () => void;
  isFreshStart: boolean;
}

interface CreateStoreSessionOptions {
  initialVerification?: WebVerifiedRunState | null;
  onlineEligible?: boolean;
}

function createStoreSession(
  initial: GameState,
  isFreshStart: boolean,
  options: CreateStoreSessionOptions = {},
): StoreSession {
  const verification = createVerifiedRunController(
    options.initialVerification
      ?? createInitialVerifiedRunState(initial, { onlineEligible: options.onlineEligible }),
  );
  const store = createGameStore(initial, {
    onDispatch(action) {
      verification.update((current) => appendVerificationAction(current, action));
    },
  });
  const stopAutosave = attachAutosave(store, verification);
  const stopAudioEvents = attachAudioEvents(store);

  return {
    store,
    verification,
    stopAutosave: () => {
      stopAutosave();
      stopAudioEvents();
    },
    isFreshStart,
  };
}

function loadSavedData(gameId?: string): SaveData | null {
  if (gameId) {
    return loadSaveData(getSaveKey(gameId));
  }

  const latestSave = getLatestSaveInfo();
  if (latestSave) {
    return loadSaveData(getSaveKey(latestSave.gameId));
  }

  return loadSaveData("datacenter-tycoon:save-v1");
}

export interface CreateFreshSessionOptions {
  difficulty?: Difficulty;
  playerName?: string;
  onlineEligible?: boolean;
}

export function createFreshSession(
  options: Difficulty | CreateFreshSessionOptions = "hard",
): StoreSession {
  const resolvedOptions = typeof options === "string"
    ? { difficulty: options }
    : options;

  const state = newGame(Math.floor(Math.random() * 2 ** 31), {
    difficulty: resolvedOptions.difficulty,
    playerName: resolvedOptions.playerName,
  });

  return createStoreSession(state, true, {
    onlineEligible: resolvedOptions.onlineEligible,
  });
}

export function createLoadedSession(
  gameId?: string,
  options: { onlineEligible?: boolean } = {},
): StoreSession | null {
  const saved = loadSavedData(gameId);
  if (!saved) {
    return null;
  }

  return createStoreSession(saved.state, false, {
    onlineEligible: options.onlineEligible,
    initialVerification: saved.verification
      ?? createLegacyLocalOnlyVerifiedRunState(saved.state),
  });
}

export function bootstrapStore(gameId?: string): StoreSession {
  return createLoadedSession(gameId) ?? createFreshSession();
}

