import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { newGame } from "@datacenter-tycoon/game-logic";
import { createGameStore } from "./store/gameStore.js";
import type { SaveInfo, StoreSession } from "./store/persist.js";

const persistMocks = vi.hoisted(() => ({
  latestSave: null as SaveInfo | null,
  createFreshSession: vi.fn<() => StoreSession>(),
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

function makeSession(kind: "fresh" | "loaded"): StoreSession {
  return {
    store: createGameStore(newGame(kind === "fresh" ? 11 : 22)),
    stopAutosave: vi.fn(),
    isFreshStart: kind === "fresh",
  };
}

const savedGameInfo: SaveInfo = {
  gameId: "save-1",
  tick: 3,
  cash: 1_250_000,
  playerName: "Acme Cloud",
  updatedAt: Date.UTC(2026, 4, 9, 12, 30, 0),
};

beforeEach(() => {
  window.location.hash = "#/";
  persistMocks.latestSave = null;
  persistMocks.getLatestSaveInfo.mockImplementation(() => persistMocks.latestSave);
  persistMocks.createFreshSession.mockImplementation(() => makeSession("fresh"));
  persistMocks.createLoadedSession.mockImplementation(() => makeSession("loaded"));
});

describe("App start flow", () => {
  it("shows Play when there is no saved game", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Load Game" })).toBeNull();
  });

  it("shows Load Game and New Game when a save exists", () => {
    persistMocks.latestSave = savedGameInfo;

    render(<App />);

    expect(screen.getByRole("button", { name: "Load Game" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "New Game" })).toBeTruthy();
    expect(screen.getByText("Acme Cloud")).toBeTruthy();
  });

  it("enters the existing save when Load Game is clicked", () => {
    persistMocks.latestSave = savedGameInfo;

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Load Game" }));

    expect(persistMocks.createLoadedSession).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("shell").getAttribute("data-auto-open")).toBe("false");
  });

  it("creates a fresh session when New Game is clicked", () => {
    persistMocks.latestSave = savedGameInfo;

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "New Game" }));

    expect(persistMocks.createFreshSession).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("shell").getAttribute("data-auto-open")).toBe("true");
  });

  it("waits to auto-open the tutorial until after the start button is clicked", () => {
    render(<App />);

    expect(screen.queryByTestId("shell")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    expect(screen.getByTestId("shell").getAttribute("data-auto-open")).toBe("true");
  });
});
