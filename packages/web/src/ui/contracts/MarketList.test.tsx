import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  newGame,
  reduce,
  DATACENTER_CATALOG,
  RACK_CATALOG,
} from "@datacenter-tycoon/game-logic";
import type { Contract, GameState } from "@datacenter-tycoon/game-logic";
import { createGameStore } from "../../store/gameStore.js";
import { StoreProvider } from "../../store/storeContext.js";
import { nextDcId, nextRackPlacementId } from "../../store/ids.js";
import { MarketList } from "./MarketList.js";

function buildMarketState(): GameState {
  let state = newGame(42, { playerName: "Acme Corp" });
  const dcId = nextDcId();
  state = reduce(state, {
    type: "BuildDatacenter",
    specId: DATACENTER_CATALOG.garage!.id,
    dcId,
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
    offeredAtTick: state.tick,
    expiresAtTick: (state.tick + 1) as Contract["expiresAtTick"],
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
      <MarketList />
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

  it("requires datacenter selection and confirmation before accepting", () => {
    const store = renderMarket();
    const dcName = store.getState().datacenters[0]!.name;

    fireEvent.click(screen.getByText("ACCEPT CONTRACT"));
    fireEvent.click(screen.getByText(dcName));

    expect(screen.getByText("CONFIRM ACCEPT")).toBeTruthy();
    fireEvent.click(screen.getByText("CONFIRM ACCEPT"));

    expect(store.getState().contractMarket).toHaveLength(0);
    expect(store.getState().activeContracts).toHaveLength(1);
    expect(store.getState().activeContracts[0]?.name).toBe("Burst Compute");
  });
});
