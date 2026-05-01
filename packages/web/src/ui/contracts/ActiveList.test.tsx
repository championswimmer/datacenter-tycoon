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
import { ActiveList } from "./ActiveList.js";

function buildActiveState(): GameState {
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
    id: "contract-active-1" as Contract["id"],
    name: "Burst Compute",
    requirements: { vCpu: 8, ramGb: 0, storageTb: 0, gpuFlops: 0 },
    monthlyPayment: 12000,
    penaltyPerMonth: 4000,
    termMonths: 3,
    status: "active",
    urgency: "standard",
    tier: 1,
    offeredAtTick: 0,
    expiresAtTick: 6,
    startedAtTick: 0,
    assignedDcId: dcId,
  };

  return {
    ...state,
    tick: 1,
    contractMarket: [],
    activeContracts: [contract],
  };
}

function renderActive(state = buildActiveState()) {
  const store = createGameStore(state);
  render(
    <StoreProvider store={store}>
      <ActiveList />
    </StoreProvider>,
  );
  return store;
}

describe("ActiveList", () => {
  it("shows elapsed contract progress in months", () => {
    renderActive();
    expect(screen.getByText("1/3 mo · 2 left")).toBeTruthy();
  });

  it("confirms cancellation before dispatching CancelContract", () => {
    const store = renderActive();
    fireEvent.click(screen.getByText("CANCEL CONTRACT"));
    expect(screen.getByText(/Cancel incurs a penalty/i)).toBeTruthy();
    fireEvent.click(screen.getByText("YES, CANCEL"));
    expect(store.getState().activeContracts[0]?.status).toBe("cancelled");
  });
});
