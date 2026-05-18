import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { newGame, reduce } from "@datacenter-tycoon/game-logic";
import {
  loadSave,
  writeSave,
  clearSave,
  clearAllSaves,
  attachAutosave,
  bootstrapStore,
  AUTOSAVE_EVERY_TICKS,
  AUTOSAVE_TICK_DEBOUNCE_MS,
  createFreshSession,
  createLoadedSession,
  getLatestSaveInfo,
  getSaveKey,
  hasAnySaves,
} from "./persist.js";
import { createGameStore } from "./gameStore.js";

// ── localStorage mock ──────────────────────────────────────────────────────────

function makeLocalStorageMock() {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]); }),
    get _store() { return store; },
  };
}

const TEST_KEY = "test:save";

beforeEach(() => {
  vi.stubGlobal("localStorage", makeLocalStorageMock());
});

afterEach(() => {
  vi.useRealTimers();
});

// ── loadSave ──────────────────────────────────────────────────────────────────

describe("loadSave", () => {
  it("returns null when nothing is stored", () => {
    expect(loadSave(TEST_KEY)).toBeNull();
  });

  it("round-trips a GameState through serialize / deserialize", () => {
    const state = newGame(99);
    writeSave(state);
    const loaded = loadSave(state.gameId);
    expect(loaded).not.toBeNull();
    expect(loaded!.seed).toBe(state.seed);
    expect(loaded!.tick).toBe(state.tick);
    expect(loaded!.player.cash).toBe(state.player.cash);
  });

  it("returns null and logs a warning on corrupt JSON", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const key = "corrupt-save";
    const fullKey = getSaveKey(key);
    localStorage.setItem(fullKey, "not-valid-json{{{");
    expect(loadSave(key)).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("returns null and logs a warning when envelope is missing saveVersion", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const key = "missing-version";
    const fullKey = getSaveKey(key);
    localStorage.setItem(fullKey, JSON.stringify({ state: {} }));
    expect(loadSave(key)).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// ── writeSave ─────────────────────────────────────────────────────────────────

describe("writeSave", () => {
  it("writes to localStorage", () => {
    const state = newGame(7);
    writeSave(state);
    expect(localStorage.setItem).toHaveBeenCalled();
  });

  it("silently swallows quota errors", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(localStorage.setItem).mockImplementationOnce(() => {
      throw new DOMException("QuotaExceededError");
    });
    expect(() => writeSave(newGame(1))).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// ── clearSave ─────────────────────────────────────────────────────────────────

describe("clearSave", () => {
  it("removes the key from localStorage", () => {
    const state = newGame(1);
    writeSave(state);
    clearSave(state.gameId);
    expect(loadSave(state.gameId)).toBeNull();
  });
});

describe("clearAllSaves", () => {
  it("wipes all saves and the index", () => {
    const s1 = newGame(1);
    const s2 = newGame(2);
    writeSave(s1);
    writeSave(s2);

    expect(loadSave(s1.gameId)).not.toBeNull();
    expect(loadSave(s2.gameId)).not.toBeNull();

    clearAllSaves();

    expect(loadSave(s1.gameId)).toBeNull();
    expect(loadSave(s2.gameId)).toBeNull();
    expect(localStorage.getItem("datacenter-tycoon:save-index")).toBeNull();
  });
});

describe("save index helpers", () => {
  it("reports when saves exist and returns the latest save info", () => {
    const older = reduce(newGame(1), { type: "Tick" });
    const latest = reduce(newGame(2), { type: "Tick" });

    writeSave(older);
    writeSave(latest);

    expect(hasAnySaves()).toBe(true);
    expect(getLatestSaveInfo()?.gameId).toBe(latest.gameId);
  });

  it("returns false/null when no saves exist", () => {
    expect(hasAnySaves()).toBe(false);
    expect(getLatestSaveInfo()).toBeNull();
  });
});

// ── attachAutosave ────────────────────────────────────────────────────────────

describe("attachAutosave", () => {
  it("saves immediately on a non-Tick dispatch", () => {
    const state = newGame(42);
    const store = createGameStore(state);
    attachAutosave(store);
    // Trigger something non-tick
    const firstRegionId = state.map.regions[0]!.id;
    store.dispatch({ type: "BuildDatacenter", specId: "garage" as any, dcId: "dc1" as any, regionId: firstRegionId });
    expect(loadSave(state.gameId)).not.toBeNull();
  });

  it("debounces tick autosaves until the threshold and timer elapse", () => {
    vi.useFakeTimers();
    const state = newGame(42);
    const store = createGameStore(state);
    attachAutosave(store, AUTOSAVE_EVERY_TICKS, AUTOSAVE_TICK_DEBOUNCE_MS);
    const setItemSpy = vi.spyOn(localStorage, "setItem");
    setItemSpy.mockClear();

    for (let i = 0; i < AUTOSAVE_EVERY_TICKS - 1; i++) {
      store.dispatch({ type: "Tick" });
    }

    expect(setItemSpy).not.toHaveBeenCalled();

    store.dispatch({ type: "Tick" });
    expect(setItemSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(AUTOSAVE_TICK_DEBOUNCE_MS - 1);
    expect(setItemSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(setItemSpy).toHaveBeenCalled();
  });

  it("flushes the latest tick state after coalescing multiple pending tick saves", () => {
    vi.useFakeTimers();
    const state = newGame(42);
    const store = createGameStore(state);
    attachAutosave(store, 1, AUTOSAVE_TICK_DEBOUNCE_MS);

    store.dispatch({ type: "Tick" });
    store.dispatch({ type: "Tick" });
    store.dispatch({ type: "Tick" });
    vi.advanceTimersByTime(AUTOSAVE_TICK_DEBOUNCE_MS);

    const loaded = loadSave(state.gameId);
    expect(loaded?.tick).toBe(store.getState().tick);
  });

  it("stop function flushes pending autosave and halts future autosave", () => {
    vi.useFakeTimers();
    const state = newGame(42);
    const store = createGameStore(state);
    const stop = attachAutosave(store, 1, AUTOSAVE_TICK_DEBOUNCE_MS);

    store.dispatch({ type: "Tick" });
    stop();

    expect(loadSave(state.gameId)?.tick).toBe(1);

    const setItemSpy = vi.spyOn(localStorage, "setItem");
    setItemSpy.mockClear();
    store.dispatch({ type: "Tick" });
    vi.runAllTimers();
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it("loaded state matches state at time of autosave", () => {
    vi.useFakeTimers();
    const state = newGame(42);
    const store = createGameStore(state);
    attachAutosave(store, 1, AUTOSAVE_TICK_DEBOUNCE_MS);
    store.dispatch({ type: "Tick" });
    store.dispatch({ type: "Tick" });
    vi.advanceTimersByTime(AUTOSAVE_TICK_DEBOUNCE_MS);

    const loaded = loadSave(state.gameId);
    expect(loaded!.tick).toBe(store.getState().tick);
  });
});

// ── bootstrapStore ────────────────────────────────────────────────────────────

describe("session creation helpers", () => {
  it("creates a fresh hard-mode session by default", () => {
    const session = createFreshSession();

    expect(session.isFreshStart).toBe(true);
    expect(session.store.getState().tick).toBe(0);
    expect(session.store.getState().difficulty).toBe("hard");
  });

  it("creates a fresh easy-mode session when requested", () => {
    const session = createFreshSession("easy");

    expect(session.isFreshStart).toBe(true);
    expect(session.store.getState().difficulty).toBe("easy");
  });

  it("restores a loaded session when a save exists", () => {
    const state = reduce(newGame(77), { type: "Tick" });
    writeSave(state);

    const session = createLoadedSession(state.gameId);
    expect(session?.isFreshStart).toBe(false);
    expect(session?.store.getState().tick).toBe(1);
    expect(session?.store.getState().seed).toBe(77);
  });

  it("returns null when no saved session exists", () => {
    expect(createLoadedSession("missing-save")).toBeNull();
  });
});

describe("bootstrapStore", () => {
  it("creates a fresh store when no save exists", () => {
    const { store } = bootstrapStore("non-existent");
    expect(store.getState().tick).toBe(0);
  });

  it("restores from an existing save", () => {
    const state = reduce(newGame(77), { type: "Tick" });
    writeSave(state);

    const { store } = bootstrapStore(state.gameId);
    expect(store.getState().tick).toBe(1);
    expect(store.getState().seed).toBe(77);
  });

  it("returns a stopAutosave function", () => {
    const { stopAutosave } = bootstrapStore(TEST_KEY);
    expect(typeof stopAutosave).toBe("function");
  });
});
