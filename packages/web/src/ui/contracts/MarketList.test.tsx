import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  newGame,
  reduce,
  DATACENTER_CATALOG,
  RACK_CATALOG,
  MARKET_REFRESH_SIZE,
} from "@datacenter-tycoon/game-logic";
import type { Contract, GameState } from "@datacenter-tycoon/game-logic";
import { createGameStore } from "../../store/gameStore.js";
import { StoreProvider } from "../../store/storeContext.js";
import { nextDcId, nextRackPlacementId } from "../../store/ids.js";
import { MarketList } from "./MarketList.js";

function buildMarketState(): GameState {
  let state = newGame(42, { playerName: "Acme Corp" });
  const dcId = nextDcId();
  const firstRegionId = state.map.regions[0]!.id;
  state = reduce(state, {
    type: "BuildDatacenter",
    specId: DATACENTER_CATALOG.garage!.id,
    dcId,
    regionId: firstRegionId,
  });
  state = reduce(state, {
    type: "PlaceRack",
    dcId,
    specId: RACK_CATALOG.C1!.id,
    row: 0,
    position: 0,
    placementId: nextRackPlacementId(),
  });

  const contract: Contract = {
    id: "contract-market-1" as Contract["id"],
    name: "Burst Compute",
    requirements: { vCpu: 8, ramGb: 0, storageTb: 0, gpuFlops: 0 },
    monthlyPayment: 12000,
    penaltyPerMonth: 4000,
    termMonths: 3,
    status: "offered",
    urgency: "standard",
    tier: 1,
    offeredAtTick: state.tick,
    expiresAtTick: (state.tick + 6) as Contract["expiresAtTick"],
  };

  return {
    ...state,
    contractMarket: [contract],
    activeContracts: [],
  };
}

function renderMarket(state = buildMarketState()) {
  const store = createGameStore(state);
  render(
    <StoreProvider store={store}>
      <MarketList contracts={store.getState().contractMarket} />
    </StoreProvider>,
  );
  return store;
}

describe("MarketList", () => {
  it("renders free capacity comparison beside requirements", () => {
    renderMarket();
    expect(screen.getByText("FREE CAPACITY")).toBeTruthy();
    expect(screen.getByText("Burst Compute")).toBeTruthy();
  });

  it("shows months-based expiry label (not ticks)", () => {
    // state.tick = 0, expiresAtTick = 6 → 6 months left
    renderMarket();
    expect(screen.getByText("6 months left")).toBeTruthy();
  });

  it("shows silver-tier market hints when reliability is limiting longer work", () => {
    const state = buildMarketState();
    state.player.reliability = {
      score: 20,
      lastDelta: -12,
      recentOutcomes: [
        {
          contractId: "contract-bad" as Contract["id"],
          contractName: "Lost Customer",
          tick: 1,
          kind: "cancelled",
        },
      ],
    };

    renderMarket(state);

    expect(screen.getByText(/Low reliability is limiting longer-term work/i)).toBeTruthy();
  });

  it("shows platinum market hints on long-term opportunities", () => {
    const state = buildMarketState();
    state.player.reliability = {
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
    };
    state.contractMarket = [
      {
        ...state.contractMarket[0]!,
        urgency: "anchor",
        termMonths: 12,
      },
    ];

    renderMarket(state);

    expect(screen.getByText(/Platinum reliability is helping surface longer-term offers like this/i)).toBeTruthy();
  });

  it("accepts a contract directly when a fitting datacenter is clicked", () => {
    const store = renderMarket();
    const dcName = store.getState().datacenters[0]!.name;

    fireEvent.click(screen.getByText("ACCEPT CONTRACT"));

    expect(screen.getByText(/Click a datacenter to accept this contract/i)).toBeTruthy();
    expect(screen.queryByText("CONFIRM ACCEPT")).toBeNull();

    fireEvent.click(screen.getByText(dcName));

    expect(store.getState().contractMarket).toHaveLength(MARKET_REFRESH_SIZE);
    expect(store.getState().activeContracts).toHaveLength(1);
    expect(store.getState().activeContracts[0]?.name).toBe("Burst Compute");
  });
});
