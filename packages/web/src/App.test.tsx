import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { newGame } from "@datacenter-tycoon/game-logic";
import type { Difficulty, GameState } from "@datacenter-tycoon/game-logic";
import { createGameStore } from "./store/gameStore.js";
import type { SaveInfo, StoreSession } from "./store/persist.js";

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
}));

vi.mock("./store/persist.js", () => ({
  createFreshSession: persistMocks.createFreshSession,
  createLoadedSession: persistMocks.createLoadedSession,
  getLatestSaveInfo: persistMocks.getLatestSaveInfo,
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

  return {
    store: createGameStore(configureState ? configureState(baseState) : baseState),
    stopAutosave: vi.fn(),
    isFreshStart: kind === "fresh",
  };
}

const PLAYER_IDENTITY_KEY = "datacenter-tycoon:player-identity-v1";
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
  persistMocks.getLatestSaveInfo.mockImplementation(() => persistMocks.latestSave);
  persistMocks.createFreshSession.mockImplementation(() => makeSession("fresh"));
  persistMocks.createLoadedSession.mockImplementation(() => makeSession("loaded"));
});

describe("App start flow", () => {
  it("shows the username prompt before the first registered run", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    expect(screen.getByLabelText("Leaderboard name")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Load Game" })).toBeNull();
    expect(screen.getByRole("radio", { name: "HARD" }).getAttribute("aria-checked")).toBe("true");
  });

  it("shows Load Game and New Game when a save exists", () => {
    persistMocks.latestSave = savedGameInfo;

    render(<App />);

    expect(screen.getByRole("button", { name: "Load Game" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "New Game" })).toBeTruthy();
    expect(screen.getByDisplayValue("Acme Cloud")).toBeTruthy();
  });

  it("enters the existing save when Load Game is clicked without re-reading latest save info", () => {
    persistMocks.latestSave = savedGameInfo;

    render(<App />);
    const initialReadCount = persistMocks.getLatestSaveInfo.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "Load Game" }));

    expect(persistMocks.createLoadedSession).toHaveBeenCalledTimes(1);
    expect(persistMocks.createLoadedSession).toHaveBeenCalledWith(savedGameInfo.gameId);
    expect(persistMocks.getLatestSaveInfo.mock.calls.length).toBe(initialReadCount);
    expect(screen.getByTestId("shell").getAttribute("data-auto-open")).toBe("false");
  });

  it("registers a first-time player before starting a fresh run", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ playerId: "player_123", username: "Acme Cloud" }), {
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
      });
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.dctycoon.test/players",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(localStorage.getItem(PLAYER_IDENTITY_KEY) ?? "null")).toEqual({
      playerId: "player_123",
      username: "Acme Cloud",
    });
    expect(screen.getByTestId("shell").getAttribute("data-auto-open")).toBe("true");
  });

  it("reuses an already-registered local identity without hitting the backend", async () => {
    localStorage.setItem(
      PLAYER_IDENTITY_KEY,
      JSON.stringify({ playerId: "player_abc", username: "Cloud Atlas" }),
    );

    render(<App />);
    expect(screen.getByText("Cloud Atlas")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    await waitFor(() => {
      expect(persistMocks.createFreshSession).toHaveBeenCalledWith({
        difficulty: "hard",
        playerName: "Cloud Atlas",
      });
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("falls back to local play when the backend is unavailable", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    render(<App />);
    fireEvent.change(screen.getByLabelText("Leaderboard name"), {
      target: { value: "Offline Ops" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    await waitFor(() => {
      expect(persistMocks.createFreshSession).toHaveBeenCalledWith({
        difficulty: "hard",
        playerName: "Offline Ops",
      });
    });

    expect(localStorage.getItem(PLAYER_IDENTITY_KEY)).toBeNull();
    expect(screen.getByText(/stay local until the backend is reachable again/i)).toBeTruthy();
  });

  it("uses the selected difficulty for a fresh game", async () => {
    localStorage.setItem(
      PLAYER_IDENTITY_KEY,
      JSON.stringify({ playerId: "player_abc", username: "Cloud Atlas" }),
    );

    render(<App />);

    fireEvent.click(screen.getByRole("radio", { name: "EASY" }));
    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    await waitFor(() => {
      expect(persistMocks.createFreshSession).toHaveBeenCalledWith({
        difficulty: "easy",
        playerName: "Cloud Atlas",
      });
    });
  });

  it("submits a shared leaderboard snapshot once gameplay has progressed", async () => {
    localStorage.setItem(
      PLAYER_IDENTITY_KEY,
      JSON.stringify({ playerId: "player_abc", username: "Cloud Atlas" }),
    );
    persistMocks.latestSave = savedGameInfo;
    persistMocks.createLoadedSession.mockImplementation(() => makeSession("loaded", (state) => ({
      ...state,
      tick: 2,
      player: {
        ...state.player,
        cash: 1_725_000,
      },
    })));
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        created: true,
        run: {
          runId: "run_123",
          playerId: "player_abc",
          clientRunId: "game-123",
          metrics: {
            money: 1_725_000,
            cumulativeRevenue: 0,
            totalServers: 0,
            computeCapacity: 0,
            memoryCapacity: 0,
            storageCapacity: 0,
            gpuCapacity: 0,
          },
          gameMonth: 2,
          submittedAt: "2026-05-18T12:00:00.000Z",
          updatedAt: "2026-05-18T12:00:00.000Z",
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
      playerId: "player_abc",
      gameMonth: 2,
      metrics: {
        money: 1_725_000,
      },
    });
  });
});
