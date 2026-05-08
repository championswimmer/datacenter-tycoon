import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import {
  DATACENTER_CATALOG,
  RACK_CATALOG,
  newGame,
  reduce,
} from "@datacenter-tycoon/game-logic";
import type { GameState } from "@datacenter-tycoon/game-logic";
import { createGameStore } from "../../store/gameStore.js";
import { StoreProvider } from "../../store/storeContext.js";
import { nextDcId, nextRackPlacementId } from "../../store/ids.js";
import { PowerView } from "./PowerView.js";

function stateWithDatacenterAndRack(): { state: GameState; dcId: ReturnType<typeof nextDcId> } {
  let state = newGame(42);
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

  return { state, dcId };
}

function renderPowerView(state: GameState, dcId: ReturnType<typeof nextDcId>) {
  const store = createGameStore(state);
  return render(
    <StoreProvider store={store}>
      <PowerView dcId={dcId} />
    </StoreProvider>,
  );
}

function metricValue(label: string): number {
  const labelEl = screen.getByText(label);
  const card = labelEl.closest("div");
  if (!card) {
    throw new Error(`No card found for label ${label}`);
  }

  const valueText = within(card).getByText(/kW$/).textContent ?? "0";
  return Number.parseFloat(valueText.replace(" kW", ""));
}

describe("PowerView", () => {
  it("shows reserved vs billed power labels and idle-baseline explainer", () => {
    const { state, dcId } = stateWithDatacenterAndRack();
    renderPowerView(state, dcId);

    expect(screen.getByText("POWER BILLING MODEL")).toBeTruthy();
    expect(screen.getByText("Reserved power")).toBeTruthy();
    expect(screen.getByText("Billed power")).toBeTruthy();
    expect(screen.getByText("Idle baseline")).toBeTruthy();
    expect(screen.getByText("Active draw")).toBeTruthy();
    expect(screen.getByText(/idle and repairing racks pay only baseline power/i)).toBeTruthy();
  });

  it("keeps reserved power stable while billed power increases when workload is active", () => {
    const { state: idleState, dcId } = stateWithDatacenterAndRack();
    const offered = idleState.contractMarket.find((contract) => contract.requirements.vCpu > 0)
      ?? idleState.contractMarket[0]!;

    const activeState: GameState = {
      ...idleState,
      contractMarket: idleState.contractMarket.filter((contract) => contract.id !== offered.id),
      activeContracts: [
        {
          ...offered,
          status: "active",
          assignedDcId: dcId,
          startedAtTick: idleState.tick,
        },
      ],
    };

    const idleRender = renderPowerView(idleState, dcId);
    const idleReserved = metricValue("Reserved power");
    const idleBilled = metricValue("Billed power");
    idleRender.unmount();

    renderPowerView(activeState, dcId);
    const activeReserved = metricValue("Reserved power");
    const activeBilled = metricValue("Billed power");

    expect(activeReserved).toBe(idleReserved);
    expect(activeBilled).toBeGreaterThan(idleBilled);
  });
});
