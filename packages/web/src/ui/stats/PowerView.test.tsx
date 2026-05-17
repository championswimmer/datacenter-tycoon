import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
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

function upgradeDatacenterToFiber(state: GameState, dcId: ReturnType<typeof nextDcId>) {
  return reduce(
    reduce(state, {
      type: "UpgradeDatacenter",
      dcId,
      trackId: "networkType",
      targetNodeId: "cat8",
    }),
    {
      type: "UpgradeDatacenter",
      dcId,
      trackId: "networkType",
      targetNodeId: "fiber",
    },
  );
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

  it("renders canonical upgrade ladders and applies the next node through store dispatch", () => {
    const { state, dcId } = stateWithDatacenterAndRack();
    renderPowerView(state, dcId);

    expect(screen.getByText("UPGRADE TRACKS")).toBeTruthy();
    expect(screen.getByText(/FABRIC LOCKED/)).toBeTruthy();

    const networkLadder = screen.getByRole("list", { name: /Network uplink upgrade ladder/i });
    expect(within(networkLadder).getByText(/Cat6 uplink/i)).toBeTruthy();
    expect(within(networkLadder).getByText(/Cat8 uplink/i)).toBeTruthy();
    expect(within(networkLadder).getByText(/Fiber uplink/i)).toBeTruthy();
    expect(within(networkLadder).getByText("Current")).toBeTruthy();
    expect(within(networkLadder).getByText("Available next")).toBeTruthy();
    expect(within(networkLadder).getByText("Locked")).toBeTruthy();

    const button = screen.getByRole("button", { name: /Upgrade to Hybrid cooling/i });
    fireEvent.click(button);

    expect(screen.getByText(/COOLING MODE/)).toBeTruthy();
    expect(screen.getAllByText(/HYBRID/).length).toBeGreaterThan(0);
    expect(screen.getByText(/UPKEEP \$900\/mo/)).toBeTruthy();
    expect(screen.getByText("MAXED")).toBeTruthy();
  });

  it("shows completed ladder nodes for already-upgraded tracks", () => {
    const { state: builtState, dcId } = stateWithDatacenterAndRack();
    const state = upgradeDatacenterToFiber(builtState, dcId);

    renderPowerView(state, dcId);

    const networkLadder = screen.getByRole("list", { name: /Network uplink upgrade ladder/i });
    expect(within(networkLadder).getAllByText("Complete")).toHaveLength(2);
    expect(within(networkLadder).getByText("Current")).toBeTruthy();
    expect(within(networkLadder).queryByText("Available next")).toBeNull();
    expect(screen.getByText(/FABRIC READY/)).toBeTruthy();
  });

  it("shows generator installs raising effective power headroom and upgrade upkeep", () => {
    const { state: builtState, dcId } = stateWithDatacenterAndRack();
    const state = reduce(builtState, {
      type: "UpgradeDatacenter",
      dcId,
      trackId: "onsiteGeneration",
      targetNodeId: "gen-1",
    });

    renderPowerView(state, dcId);

    expect(screen.getByText(/Onsite generation/i)).toBeTruthy();
    expect(screen.getByText(/25 kW/)).toBeTruthy();
    expect(screen.getByText(/POWER ENVELOPE/i)).toBeTruthy();
    expect(screen.getByText(/85 kW/)).toBeTruthy();
    expect(screen.getByText(/UPKEEP \$1,600\/mo/)).toBeTruthy();
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

  it("shows pooled regional fabric capacity when a datacenter is linked into a fabric", () => {
    let state = newGame(42, { startingCash: 8_000_000 });
    const dcA = nextDcId();
    const dcB = nextDcId();
    const firstRegionId = state.map.regions[0]!.id;

    for (const dcId of [dcA, dcB] as const) {
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
      state = upgradeDatacenterToFiber(state, dcId);
    }

    state = reduce(state, { type: "FabricLink", sourceDcId: dcA, targetDcId: dcB });

    renderPowerView(state, dcA);

    expect(screen.getByText("REGIONAL FABRIC POOL")).toBeTruthy();
    expect(screen.getByText(/2-site pooled block available to this datacenter/)).toBeTruthy();
    expect(screen.getByText("REGIONAL FABRIC STATUS")).toBeTruthy();
    expect(screen.getByText(/LINKED/)).toBeTruthy();
  });
});
