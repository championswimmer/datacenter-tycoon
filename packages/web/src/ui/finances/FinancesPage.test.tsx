import { newGame } from "@datacenter-tycoon/game-logic";
import type { FinancialSnapshot, GameState } from "@datacenter-tycoon/game-logic";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createGameStore } from "../../store/gameStore.js";
import { StoreProvider } from "../../store/storeContext.js";
import { FinancesPage } from "./FinancesPage.js";

function snapshot(partial: Partial<FinancialSnapshot> & Pick<FinancialSnapshot, "tick" | "cash">): FinancialSnapshot {
  return {
    revenue: 0,
    opex: 0,
    penalty: 0,
    capex: 0,
    netOperating: 0,
    netCashFlow: 0,
    cumulativeRevenue: 0,
    ...partial,
  };
}

function Wrapper({ children, state = newGame(42) }: { children: React.ReactNode; state?: GameState }) {
  const store = createGameStore(state);
  return <StoreProvider store={store}>{children}</StoreProvider>;
}

describe("FinancesPage", () => {
  it("renders summary cards, charts, and the monthly history table", () => {
    const base = newGame(42, { playerName: "Acme Corp" });
    const state: GameState = {
      ...base,
      player: {
        ...base.player,
        cash: 152_000,
      },
      financialHistory: [
        snapshot({ tick: 0, cash: 100_000 }),
        snapshot({ tick: 1, cash: 112_000, revenue: 18_000, opex: 6_000, netOperating: 12_000, netCashFlow: 12_000, cumulativeRevenue: 18_000 }),
        snapshot({ tick: 2, cash: 152_000, revenue: 62_000, opex: 10_000, penalty: 2_000, capex: 10_000, netOperating: 50_000, netCashFlow: 40_000, cumulativeRevenue: 80_000 }),
      ],
    };

    render(
      <Wrapper state={state}>
        <FinancesPage />
      </Wrapper>,
    );

    expect(screen.getByRole("heading", { name: "FINANCES" })).toBeTruthy();
    expect(screen.getByText("Current cash")).toBeTruthy();
    expect(screen.getByText("Cumulative revenue")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Cash history chart" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Monthly profit and loss chart" })).toBeTruthy();
    expect(screen.getByText("MONTHLY HISTORY")).toBeTruthy();
    expect(screen.getByText("2 recorded months")).toBeTruthy();
    expect(screen.getByText("$80,000")).toBeTruthy();
  });

  it("shows empty states before the first month closes", () => {
    render(
      <Wrapper>
        <FinancesPage />
      </Wrapper>,
    );

    expect(screen.getByText("Finance history will populate after the first month closes.")).toBeTruthy();
    expect(screen.getByText("Monthly revenue and profit bars appear after the first month closes.")).toBeTruthy();
  });
});
