import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DAYS_PER_TICK, newGame } from "@datacenter-tycoon/game-logic";
import type { Difficulty, GameState } from "@datacenter-tycoon/game-logic";
import {
  appendVerificationAction,
  createInitialVerifiedRunState,
  createVerifiedRunController,
  type WebVerifiedRunState,
} from "./online/verified-run.js";
import { createGameStore } from "./store/gameStore.js";
import type { SaveInfo, StoreSession } from "./store/persist.js";
import { SPEED_INTERVALS_MS } from "./store/tickDriver.js";

interface FreshSessionOptions {
  difficulty?: Difficulty;
  playerName?: string;
}

const fetchMock = vi.hoisted(() => vi.fn<typeof fetch>());
const persistMocks = vi.hoisted(() => ({
  latestSave: null as SaveInfo | null,
  createFreshSession: vi.fn<(options?: Difficulty | FreshSessionOptions) => StoreSession>(),
  createLoadedSession: vi.fn<() => StoreSession | null>(),
  getLatestSaveInfo: vi.fn<() => SaveInfo | null>(),
  writeSaveData: vi.fn(),
}));

vi.mock("./store/persist.js", () => ({
  createFreshSession: persistMocks.createFreshSession,
  createLoadedSession: persistMocks.createLoadedSession,
  getLatestSaveInfo: persistMocks.getLatestSaveInfo,
  writeSaveData: persistMocks.writeSaveData,
}));

vi.mock("./ui/shell/Shell.js", () => ({
  Shell: ({ shouldAutoOpenTutorial = false }: { shouldAutoOpenTutorial?: boolean }) => (
    <div data-testid="shell" data-auto-open={String(shouldAutoOpenTutorial)}>
      shell
    </div>
  ),
}));

import App from "./App.js";

function makeSession(
  kind: "fresh" | "loaded",
  configureState?: (state: GameState) => GameState,
): StoreSession {
  const baseState = newGame(kind === "fresh" ? 11 : 22);

  const state = configureState ? configureState(baseState) : baseState;

  return {
    store: createGameStore(state),
    verification: createVerifiedRunController(createInitialVerifiedRunState(state)),
    stopAutosave: vi.fn(),
    isFreshStart: kind === "fresh",
  };
}

/**
 * Mirrors createStoreSession()'s wiring so dispatches actually accumulate
 * verification actions — makeSession() leaves the store and the verification
 * controller unconnected, which hides checkpoint-cadence regressions.
 */
function makeVerifiedSession(
  overrides: Partial<WebVerifiedRunState> = {},
): StoreSession {
  const state = newGame(22);
  const verification = createVerifiedRunController({
    ...createInitialVerifiedRunState(state, { onlineEligible: true }),
    ...overrides,
  });
  const store = createGameStore(state, {
    onDispatch(action) {
      verification.update((current) => appendVerificationAction(current, action));
    },
  });

  return { store, verification, stopAutosave: vi.fn(), isFreshStart: false };
}

/** Subtick spacing the real tick driver produces at each speed, in whole ms. */
const SUBTICK_MS_AT_SPEED = {
  1: Math.round(SPEED_INTERVALS_MS[1] / DAYS_PER_TICK), // 333ms — 1 month / 10s
  3: Math.round(SPEED_INTERVALS_MS[3] / DAYS_PER_TICK), // 83ms  — 1 month / 2.5s
} as const;

/** Lets pending fetch/microtask chains settle without moving the fake clock. */
async function flushPromises(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

/**
 * Drives `subticks` store dispatches spaced `intervalMs` of fake time apart,
 * the way the rAF tick driver does during real play. Dispatching without also
 * advancing the clock would let a debounce drain in the gap and mask the very
 * regression these tests exist for.
 */
async function runSubticks(
  session: StoreSession,
  subticks: number,
  intervalMs: number,
): Promise<void> {
  for (let start = 0; start < subticks; start += DAYS_PER_TICK) {
    const end = Math.min(start + DAYS_PER_TICK, subticks);
    await act(async () => {
      for (let i = start; i < end; i++) {
        session.store.dispatch({ type: "Subtick" });
        vi.advanceTimersByTime(intervalMs);
      }
    });
    await flushPromises();
  }
}

function checkpointResponse(): Response {
  return new Response(JSON.stringify({
    created: true,
    rootHash: "a".repeat(64),
    headHash: "b".repeat(64),
    gameMonth: 0,
    metrics: {
      money: 0,
      cumulativeRevenue: 0,
      totalServers: 0,
      computeCapacity: 0,
      memoryCapacity: 0,
      storageCapacity: 0,
      gpuCapacity: 0,
    },
  }), { status: 201, headers: { "content-type": "application/json" } });
}

function countCheckpointPosts(): number {
  return fetchMock.mock.calls.filter(
    ([url]) => String(url) === "https://api.dctycoon.test/leaderboard/runs",
  ).length;
}

const PLAYER_IDENTITY_KEY = "datacenter-tycoon:player-identity-v1";
const ACME_PLAYER_ID = "550e8400-e29b-41d4-a716-446655440000";
const LOCAL_OPS_PLAYER_ID = "72f3f58a-b2eb-4f55-9d11-5f9d4d0d4f6e";
const CLOUD_ATLAS_PLAYER_ID = "8d8f3b8f-0d43-4d7a-a2d0-8c2b6fd0d927";

const savedGameInfo: SaveInfo = {
  gameId: "save-1",
  tick: 3,
  cash: 1_250_000,
  playerName: "Acme Cloud",
  updatedAt: Date.UTC(2026, 4, 9, 12, 30, 0),
};

beforeEach(() => {
  window.location.hash = "#/";
  localStorage.clear();
  vi.stubEnv("VITE_API_BASE_URL", "https://api.dctycoon.test");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  persistMocks.latestSave = null;
  persistMocks.getLatestSaveInfo.mockReset();
  persistMocks.createFreshSession.mockReset();
  persistMocks.createLoadedSession.mockReset();
  persistMocks.getLatestSaveInfo.mockImplementation(() => persistMocks.latestSave);
  persistMocks.writeSaveData.mockReset();
  persistMocks.createFreshSession.mockImplementation(() => makeSession("fresh"));
  persistMocks.createLoadedSession.mockImplementation(() => makeSession("loaded"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("App start flow", () => {
  it("shows the username prompt before the first registered run", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "View Leaderboard" })).toBeTruthy();
    expect(screen.getByLabelText("Leaderboard name")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Load Game" })).toBeNull();
    expect(screen.getByRole("radio", { name: "HARD" }).getAttribute("aria-checked")).toBe("true");
  });

  it("shows Load Game, New Game, and View Leaderboard when a save exists", () => {
    persistMocks.latestSave = savedGameInfo;

    render(<App />);

    expect(screen.getByRole("button", { name: "Load Game" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "New Game" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "View Leaderboard" })).toBeTruthy();
    expect(screen.getByDisplayValue("Acme Cloud")).toBeTruthy();
  });

  it("enters the existing save when Load Game is clicked without re-reading latest save info", () => {
    persistMocks.latestSave = savedGameInfo;

    render(<App />);
    const initialReadCount = persistMocks.getLatestSaveInfo.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "Load Game" }));

    expect(persistMocks.createLoadedSession).toHaveBeenCalledTimes(1);
    expect(persistMocks.createLoadedSession).toHaveBeenCalledWith(savedGameInfo.gameId, {
      onlineEligible: false,
    });
    expect(persistMocks.getLatestSaveInfo.mock.calls.length).toBe(initialReadCount);
    expect(screen.getByTestId("shell").getAttribute("data-auto-open")).toBe("false");
  });

  it("registers a first-time player before starting a fresh run", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ playerId: ACME_PLAYER_ID, username: "Acme Cloud" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );

    render(<App />);
    fireEvent.change(screen.getByLabelText("Leaderboard name"), {
      target: { value: "Acme Cloud" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    await waitFor(() => {
      expect(persistMocks.createFreshSession).toHaveBeenCalledWith({
        difficulty: "hard",
        playerName: "Acme Cloud",
        onlineEligible: true,
      });
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.dctycoon.test/players",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(localStorage.getItem(PLAYER_IDENTITY_KEY) ?? "null")).toEqual({
      playerId: ACME_PLAYER_ID,
      username: "Acme Cloud",
    });
    expect(screen.getByTestId("shell").getAttribute("data-auto-open")).toBe("true");
  });

  it("targets localhost automatically during development when no explicit API URL is configured", async () => {
    vi.stubEnv("MODE", "development");
    vi.stubEnv("VITE_API_BASE_URL", "");
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ playerId: LOCAL_OPS_PLAYER_ID, username: "Local Ops" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );

    render(<App />);
    fireEvent.change(screen.getByLabelText("Leaderboard name"), {
      target: { value: "Local Ops" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:3000/players",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("shows a clear error when the chosen leaderboard name is already claimed", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        error: {
          code: "USERNAME_UNAVAILABLE",
          message: "That username is already taken.",
        },
      }), {
        status: 409,
        headers: { "content-type": "application/json" },
      }),
    );

    render(<App />);
    fireEvent.change(screen.getByLabelText("Leaderboard name"), {
      target: { value: "John Doe123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toMatch(/already claimed\. pick another one/i);
    });

    expect(persistMocks.createFreshSession).not.toHaveBeenCalled();
    expect(localStorage.getItem(PLAYER_IDENTITY_KEY)).toBeNull();
  });

  it("reuses an already-registered local identity without hitting the backend", async () => {
    localStorage.setItem(
      PLAYER_IDENTITY_KEY,
      JSON.stringify({ playerId: CLOUD_ATLAS_PLAYER_ID, username: "Cloud Atlas" }),
    );

    render(<App />);
    expect(screen.getByText("Cloud Atlas")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    await waitFor(() => {
      expect(persistMocks.createFreshSession).toHaveBeenCalledWith({
        difficulty: "hard",
        playerName: "Cloud Atlas",
        onlineEligible: true,
      });
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to local play when the backend is unavailable", async () => {
    vi.useFakeTimers();
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    render(<App />);
    fireEvent.change(screen.getByLabelText("Leaderboard name"), {
      target: { value: "Offline Ops" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(persistMocks.createFreshSession).toHaveBeenCalledWith({
      difficulty: "hard",
      playerName: "Offline Ops",
      onlineEligible: false,
    });
    expect(localStorage.getItem(PLAYER_IDENTITY_KEY)).toBeNull();
    expect(screen.getByText(/stay local until the backend is reachable again/i)).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(3_000);
    });

    expect(screen.queryByText(/stay local until the backend is reachable again/i)).toBeNull();
  });

  it("falls back to local play when online registration is intentionally disabled in production", async () => {
    vi.useFakeTimers();
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_API_BASE_URL", "");

    render(<App />);
    fireEvent.change(screen.getByLabelText("Leaderboard name"), {
      target: { value: "Offline Build" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(persistMocks.createFreshSession).toHaveBeenCalledWith({
      difficulty: "hard",
      playerName: "Offline Build",
      onlineEligible: false,
    });
    expect(screen.getByText(/registration is disabled for this build/i)).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(3_000);
    });

    expect(screen.queryByText(/registration is disabled for this build/i)).toBeNull();
  });

  it("uses the selected difficulty for a fresh game", async () => {
    localStorage.setItem(
      PLAYER_IDENTITY_KEY,
      JSON.stringify({ playerId: CLOUD_ATLAS_PLAYER_ID, username: "Cloud Atlas" }),
    );

    render(<App />);

    fireEvent.click(screen.getByRole("radio", { name: "EASY" }));
    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    await waitFor(() => {
      expect(persistMocks.createFreshSession).toHaveBeenCalledWith({
        difficulty: "easy",
        playerName: "Cloud Atlas",
        onlineEligible: true,
      });
    });
  });

  it("shows only revenue and servers leaderboard tabs with metric-specific details", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);

      if (url.includes("metric=cumulativeRevenue")) {
        return new Response(JSON.stringify({
          metric: "cumulativeRevenue",
          period: "all-time",
          limit: 10,
          visibility: url.includes("visibility=verified") ? "verified" : "all",
          entries: [
            {
              rank: 1,
              playerId: CLOUD_ATLAS_PLAYER_ID,
              username: "Cloud Atlas",
              metric: "cumulativeRevenue",
              value: 900_000,
              submittedAt: "2026-05-19T12:00:00.000Z",
              gameMonth: 18,
              metrics: {
                money: 2_400_000,
                cumulativeRevenue: 900_000,
                totalServers: 12,
                computeCapacity: 640,
                memoryCapacity: 1024,
                storageCapacity: 256,
                gpuCapacity: 32,
              },
            },
          ],
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      if (url.includes("metric=totalServers")) {
        return new Response(JSON.stringify({
          metric: "totalServers",
          period: "all-time",
          limit: 10,
          visibility: url.includes("visibility=verified") ? "verified" : "all",
          entries: [
            {
              rank: 1,
              playerId: CLOUD_ATLAS_PLAYER_ID,
              username: "Cloud Atlas",
              metric: "totalServers",
              value: 42,
              submittedAt: "2026-05-20T12:00:00.000Z",
              gameMonth: 18,
              metrics: {
                money: 2_400_000,
                cumulativeRevenue: 900_000,
                totalServers: 42,
                computeCapacity: 640,
                memoryCapacity: 1024,
                storageCapacity: 256,
                gpuCapacity: 32,
              },
            },
          ],
        }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      throw new Error(`Unexpected leaderboard request: ${url}`);
    });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "View Leaderboard" }));

    expect(await screen.findByRole("dialog", { name: "Revenue Leaderboard" })).toBeTruthy();
    expect(await screen.findByText("Cloud Atlas")).toBeTruthy();
    expect(screen.getByText("$900,000")).toBeTruthy();
    expect(screen.getByText("Cash")).toBeTruthy();
    expect(screen.getByText("$2,400,000")).toBeTruthy();
    expect(screen.getByText("Played Through")).toBeTruthy();
    expect(screen.getByText("1 year 6 months")).toBeTruthy();
    expect(screen.getAllByText("Servers")).toHaveLength(2);
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cash" })).toBeNull();
    expect(screen.getByRole("switch", { name: "Leaderboard visibility" }).getAttribute("aria-checked")).toBe("false");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.dctycoon.test/leaderboard?metric=cumulativeRevenue&period=all-time&limit=10&visibility=all",
    );

    fireEvent.click(screen.getByRole("button", { name: "Servers" }));

    expect(await screen.findByRole("dialog", { name: "Servers Leaderboard" })).toBeTruthy();
    expect(await screen.findByText("42")).toBeTruthy();
    expect(screen.getByText("Compute")).toBeTruthy();
    expect(screen.getByText("640 vCPU")).toBeTruthy();
    expect(screen.getByText("Memory")).toBeTruthy();
    expect(screen.getByText("1,024 GB")).toBeTruthy();
    expect(screen.getByText("Storage")).toBeTruthy();
    expect(screen.getByText("256 TB")).toBeTruthy();
    expect(screen.getByText("GPU")).toBeTruthy();
    expect(screen.getByText("32 TFLOPS")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.dctycoon.test/leaderboard?metric=totalServers&period=all-time&limit=10&visibility=all",
    );

    fireEvent.click(screen.getByRole("switch", { name: "Leaderboard visibility" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.dctycoon.test/leaderboard?metric=totalServers&period=all-time&limit=10&visibility=verified",
      );
    });
    expect(screen.getByRole("switch", { name: "Leaderboard visibility" }).getAttribute("aria-checked")).toBe("true");

    const fetchCallCount = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Revenue" }));

    expect(await screen.findByRole("dialog", { name: "Revenue Leaderboard" })).toBeTruthy();
    expect(await screen.findByText("$900,000")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.dctycoon.test/leaderboard?metric=cumulativeRevenue&period=all-time&limit=10&visibility=verified",
    );

    const verifiedFetchCallCount = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByRole("switch", { name: "Leaderboard visibility" }));

    expect(await screen.findByRole("dialog", { name: "Revenue Leaderboard" })).toBeTruthy();
    expect(await screen.findByText("$900,000")).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Leaderboard visibility" }).getAttribute("aria-checked")).toBe("false");
    expect(fetchMock.mock.calls).toHaveLength(verifiedFetchCallCount);

    fireEvent.click(screen.getByRole("button", { name: "Close leaderboard" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Revenue Leaderboard" })).toBeNull();
    });
  });

  it("shows leaderboard query errors inside the start-screen dialog", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        error: {
          code: "LEADERBOARD_UNAVAILABLE",
          message: "Online leaderboard submission is not configured.",
        },
      }), {
        status: 503,
        headers: { "content-type": "application/json" },
      }),
    );

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "View Leaderboard" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Online leaderboard submission is not configured.",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.dctycoon.test/leaderboard?metric=cumulativeRevenue&period=all-time&limit=10&visibility=all",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("submits a shared leaderboard snapshot once gameplay has progressed", async () => {
    localStorage.setItem(
      PLAYER_IDENTITY_KEY,
      JSON.stringify({ playerId: CLOUD_ATLAS_PLAYER_ID, username: "Cloud Atlas" }),
    );
    persistMocks.latestSave = savedGameInfo;
    persistMocks.createLoadedSession.mockImplementation(() => {
      const session = makeSession("loaded", (state) => ({
        ...state,
        tick: 2,
        player: {
          ...state.player,
          cash: 1_725_000,
        },
      }));
      session.verification.setState({
        ...session.verification.getState(),
        status: "pending-genesis",
        pendingActions: [{ type: "Tick" }],
      });
      return session;
    });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        created: true,
        rootHash: "a".repeat(64),
        headHash: "b".repeat(64),
        gameMonth: 2,
        metrics: {
          money: 1_725_000,
          cumulativeRevenue: 0,
          totalServers: 0,
          computeCapacity: 0,
          memoryCapacity: 0,
          storageCapacity: 0,
          gpuCapacity: 0,
        },
      }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Load Game" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.dctycoon.test/leaderboard/runs",
        expect.objectContaining({ method: "POST" }),
      );
    });

    const [, requestInit] = fetchMock.mock.calls[0] ?? [];
    expect(JSON.parse(String(requestInit?.body))).toMatchObject({
      playerId: CLOUD_ATLAS_PLAYER_ID,
      parentHeadHash: null,
      actions: [{ type: "Tick" }],
    });
  });

  it("keeps checkpointing every 5 game months while the game is running", async () => {
    vi.useFakeTimers();
    localStorage.setItem(
      PLAYER_IDENTITY_KEY,
      JSON.stringify({ playerId: CLOUD_ATLAS_PLAYER_ID, username: "Cloud Atlas" }),
    );
    persistMocks.latestSave = savedGameInfo;

    let session!: StoreSession;
    persistMocks.createLoadedSession.mockImplementation(() => {
      session = makeVerifiedSession({ pendingActions: [{ type: "Tick" }] });
      return session;
    });
    fetchMock.mockImplementation(async () => checkpointResponse());

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Load Game" }));

    // The genesis checkpoint goes out as soon as the run has a pending action.
    await flushPromises();
    expect(countCheckpointPosts()).toBe(1);

    // Play at 3× — 5 months takes 12.5s, so the tick budget is what fires here,
    // not the 15s wall clock.
    const speed = SUBTICK_MS_AT_SPEED[3];

    // Four months must NOT trigger another submission…
    await runSubticks(session, 4 * DAYS_PER_TICK, speed);
    expect(countCheckpointPosts()).toBe(1);

    // …but the fifth one must.
    await runSubticks(session, DAYS_PER_TICK, speed);
    expect(countCheckpointPosts()).toBe(2);

    // And the cadence repeats rather than firing once.
    await runSubticks(session, 5 * DAYS_PER_TICK, speed);
    expect(countCheckpointPosts()).toBe(3);
  });

  it("checkpoints on the 15 second wall clock when ticks are too slow to trigger", async () => {
    vi.useFakeTimers();
    localStorage.setItem(
      PLAYER_IDENTITY_KEY,
      JSON.stringify({ playerId: CLOUD_ATLAS_PLAYER_ID, username: "Cloud Atlas" }),
    );
    persistMocks.latestSave = savedGameInfo;

    let session!: StoreSession;
    persistMocks.createLoadedSession.mockImplementation(() => {
      session = makeVerifiedSession();
      return session;
    });
    fetchMock.mockImplementation(async () => checkpointResponse());

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Load Game" }));

    // At 1× a month takes 10s, so 5 months is 50s away — only the wall clock
    // can push a checkpoint out inside this window.
    const speed = SUBTICK_MS_AT_SPEED[1];

    await runSubticks(session, 40, speed); // ~13.3s elapsed, 1 game month
    expect(countCheckpointPosts()).toBe(0);

    await runSubticks(session, 10, speed); // ~16.7s elapsed, still 1 game month
    expect(countCheckpointPosts()).toBe(1);
    expect(session.store.getState().tick).toBeLessThan(5);
  });

  it("uses the explicit production API override for leaderboard sync", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_API_BASE_URL", "https://prod.api.dctycoon.test");
    localStorage.setItem(
      PLAYER_IDENTITY_KEY,
      JSON.stringify({ playerId: CLOUD_ATLAS_PLAYER_ID, username: "Cloud Atlas" }),
    );
    persistMocks.latestSave = savedGameInfo;
    persistMocks.createLoadedSession.mockImplementation(() => {
      const session = makeSession("loaded", (state) => ({
        ...state,
        tick: 2,
      }));
      session.verification.setState({
        ...session.verification.getState(),
        status: "pending-genesis",
        pendingActions: [{ type: "Tick" }],
      });
      return session;
    });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        created: true,
        rootHash: "c".repeat(64),
        headHash: "d".repeat(64),
        gameMonth: 2,
        metrics: {
          money: 1_250_000,
          cumulativeRevenue: 0,
          totalServers: 0,
          computeCapacity: 0,
          memoryCapacity: 0,
          storageCapacity: 0,
          gpuCapacity: 0,
        },
      }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Load Game" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "https://prod.api.dctycoon.test/leaderboard/runs",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});
