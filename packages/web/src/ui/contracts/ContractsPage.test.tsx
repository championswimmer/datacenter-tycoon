import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { newGame } from "@datacenter-tycoon/game-logic";
import type { Contract, GameState } from "@datacenter-tycoon/game-logic";
import { createGameStore } from "../../store/gameStore.js";
import { StoreProvider } from "../../store/storeContext.js";
import { ContractsPage } from "./ContractsPage.js";

function renderContractsPage(state: GameState = newGame(42, { playerName: "Acme Corp" })) {
  const store = createGameStore(state);
  render(
    <StoreProvider store={store}>
      <ContractsPage />
    </StoreProvider>,
  );
  return store;
}

describe("ContractsPage", () => {
  it("surfaces baseline reliability guidance in the contracts header", () => {
    renderContractsPage();

    expect(screen.getByText("RELIABILITY OUTLOOK")).toBeTruthy();
    expect(screen.getByText("50 · BASELINE")).toBeTruthy();
    expect(screen.getByText("— steady last tick")).toBeTruthy();
    expect(screen.getByText("Fulfilled contracts improve future opportunities; breaches reduce them.")).toBeTruthy();
    expect(screen.getByText("6 standard market offers")).toBeTruthy();
    expect(screen.getByText("Balanced mix of short and long-term work.")).toBeTruthy();
  });

  it("updates contracts guidance for trusted reliability states", () => {
    const base = newGame(42, { playerName: "Acme Corp" });
    const trustedState: GameState = {
      ...base,
      player: {
        ...base.player,
        reliability: {
          score: 77,
          lastDelta: 3,
          recentOutcomes: [
            {
              contractId: "contract-good" as Contract["id"],
              contractName: "Trusted Anchor",
              tick: 1,
              kind: "fulfilled",
            },
          ],
        },
      },
    };

    renderContractsPage(trustedState);

    expect(screen.getByText("77 · TRUSTED")).toBeTruthy();
    expect(screen.getByText("▲ +3 last tick")).toBeTruthy();
    expect(screen.getByText("Reliable fulfillment unlocks more offers and better long-term contract mix.")).toBeTruthy();
    expect(screen.getByText("8 market offers with extra premium access")).toBeTruthy();
    expect(screen.getByText("Longer anchor contracts appear more often.")).toBeTruthy();
  });
});
