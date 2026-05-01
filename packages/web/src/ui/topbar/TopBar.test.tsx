import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { newGame } from "@datacenter-tycoon/game-logic";
import type { Contract, GameState } from "@datacenter-tycoon/game-logic";
import { createGameStore } from "../../store/gameStore.js";
import { StoreProvider } from "../../store/storeContext.js";
import { TopBar } from "./TopBar.js";

function Wrapper({
  children,
  state = newGame(42, { playerName: "Acme Corp" }),
}: {
  children: React.ReactNode;
  state?: GameState;
}) {
  const store = createGameStore(state);
  return <StoreProvider store={store}>{children}</StoreProvider>;
}

describe("TopBar", () => {
  it("renders player name", () => {
    render(
      <Wrapper>
        <TopBar speed={1} onSpeedChange={() => {}} />
      </Wrapper>,
    );
    expect(screen.getByText("Acme Corp")).toBeTruthy();
  });

  it("renders all 4 speed buttons", () => {
    render(
      <Wrapper>
        <TopBar speed={1} onSpeedChange={() => {}} />
      </Wrapper>,
    );
    expect(screen.getByTitle("Pause")).toBeTruthy();
    expect(screen.getByTitle("1× speed")).toBeTruthy();
    expect(screen.getByTitle("2× speed")).toBeTruthy();
    expect(screen.getByTitle("3× speed")).toBeTruthy();
  });

  it("always renders a contracts button that navigates to contracts", () => {
    render(
      <Wrapper>
        <TopBar speed={1} onSpeedChange={() => {}} />
      </Wrapper>,
    );

    const button = screen.getByTitle("Open contracts market");
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(window.location.hash).toBe("#/contracts");
  });

  it("marks the active speed button as pressed", () => {
    render(
      <Wrapper>
        <TopBar speed={2} onSpeedChange={() => {}} />
      </Wrapper>,
    );
    const btn = screen.getByTitle("2× speed");
    expect(btn.getAttribute("aria-pressed")).toBe("true");
  });

  it("renders CASH hudLabel", () => {
    render(
      <Wrapper>
        <TopBar speed={1} onSpeedChange={() => {}} />
      </Wrapper>,
    );
    expect(screen.getByText("CASH")).toBeTruthy();
  });

  it("shows an expiring contracts banner that navigates to contracts", () => {
    const base = newGame(42, { playerName: "Acme Corp" });
    const warnedState: GameState = {
      ...base,
      contractMarket: [{
        id: "contract-warning" as Contract["id"],
        name: "Near Expiry",
        requirements: { vCpu: 1, ramGb: 0, storageTb: 0, gpuFlops: 0 },
        monthlyPayment: 1000,
        penaltyPerMonth: 100,
        termMonths: 1,
        status: "offered",
        urgency: "standard",
        tier: 1,
        offeredAtTick: 0,
        expiresAtTick: 1,
      }],
    };

    render(
      <Wrapper state={warnedState}>
        <TopBar speed={1} onSpeedChange={() => {}} />
      </Wrapper>,
    );

    const badge = screen.getByTitle("Open contracts");
    expect(badge.textContent).toContain("expiring soon");
    badge.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(window.location.hash).toBe("#/contracts");
  });
});
