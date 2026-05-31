import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { newGame } from "@datacenter-tycoon/game-logic";
import type { Contract, GameState } from "@datacenter-tycoon/game-logic";
import { createGameStore } from "../../store/gameStore.js";
import { StoreProvider } from "../../store/storeContext.js";
import { setTickFraction } from "../../store/tickFractionStore.js";
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

afterEach(() => {
  // Reset fraction to 0 between tests so they don't bleed into each other
  act(() => setTickFraction(0));
});

describe("TopBar", () => {
  it("renders player name and difficulty badge", () => {
    render(
      <Wrapper>
        <TopBar speed={1} onSpeedChange={() => {}} />
      </Wrapper>,
    );
    expect(screen.getByText("Acme Corp")).toBeTruthy();
    expect(screen.getByText("HARD")).toBeTruthy();
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

  it("renders DATE hudLabel instead of TICK", () => {
    render(
      <Wrapper>
        <TopBar speed={1} onSpeedChange={() => {}} />
      </Wrapper>,
    );
    expect(screen.getByText("DATE")).toBeTruthy();
    expect(screen.queryByText("TICK")).toBeNull();
  });

  it("shows total cumulative revenue derived from revenue ledger entries", () => {
    const base = newGame(42, { playerName: "Acme Corp" });
    const revenueState: GameState = {
      ...base,
      ledger: [
        { id: "ledger-rev-1" as GameState["ledger"][number]["id"], tick: 0, type: "revenue", amount: 5_000, reason: "Contract Alpha" },
        { id: "ledger-opex-1" as GameState["ledger"][number]["id"], tick: 0, type: "opex", amount: -2_000, reason: "Operations" },
        { id: "ledger-rev-2" as GameState["ledger"][number]["id"], tick: 1, type: "revenue", amount: 7_000, reason: "Contract Beta" },
        { id: "ledger-penalty-1" as GameState["ledger"][number]["id"], tick: 1, type: "penalty", amount: -300, reason: "SLA breach" },
      ],
    };

    render(
      <Wrapper state={revenueState}>
        <TopBar speed={1} onSpeedChange={() => {}} />
      </Wrapper>,
    );

    expect(screen.getByText("TOTAL REV")).toBeTruthy();
    expect(screen.getByText("$12.0K")).toBeTruthy();
  });

  it("renders reliability score and market effect count in the persistent HUD", () => {
    render(
      <Wrapper>
        <TopBar speed={1} onSpeedChange={() => {}} />
      </Wrapper>,
    );
    expect(screen.getByText("RELIABILITY")).toBeTruthy();
    expect(screen.getByText("50 · GOLD")).toBeTruthy();
    expect(screen.getByText("— steady · 6 offers")).toBeTruthy();
  });

  it("shows formatted date at tick 0 as '1 Jan 2025'", () => {
    render(
      <Wrapper>
        <TopBar speed={1} onSpeedChange={() => {}} />
      </Wrapper>,
    );
    // tick 0, fraction 0 → "1 Jan 2025"
    expect(screen.getByText("1 Jan 2025")).toBeTruthy();
  });

  it("uses authoritative date state while tick fraction animates within the day", () => {
    render(
      <Wrapper>
        <TopBar speed={1} onSpeedChange={() => {}} />
      </Wrapper>,
    );
    act(() => setTickFraction(0.5));
    expect(screen.getByText("1 Jan 2025")).toBeTruthy();
  });

  it("uses authoritative subtick plus animation fraction for the displayed date", () => {
    const base = newGame(42, { playerName: "Acme Corp" });
    const midMonthState: GameState = { ...base, tick: 0, subtick: 10 };

    render(
      <Wrapper state={midMonthState}>
        <TopBar speed={1} onSpeedChange={() => {}} />
      </Wrapper>,
    );

    expect(screen.getByText("11 Jan 2025")).toBeTruthy();
    act(() => setTickFraction(0.5));
    expect(screen.getByText("11 Jan 2025")).toBeTruthy();
  });

  it("shows platinum reliability changes in the HUD when store state changes", () => {
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

    render(
      <Wrapper state={trustedState}>
        <TopBar speed={1} onSpeedChange={() => {}} />
      </Wrapper>,
    );

    expect(screen.getByText("77 · PLATINUM")).toBeTruthy();
    expect(screen.getByText("▲ +3 · 8 offers")).toBeTruthy();
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
        slaTargetPercent: 90,
        currentSlaWindow: { sampledDays: 0, servedDays: 0, failedDays: 0 },
        lifecycleState: "market_open",
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
    expect(badge.textContent).toContain("expiring within 1 month");
    badge.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(window.location.hash).toBe("#/contracts");
  });
});
