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
  const renderResult = render(
    <StoreProvider store={store}>
      <PowerView dcId={dcId} />
    </StoreProvider>,
  );

  return {
    store,
    ...renderResult,
  };
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

  it("renders canonical upgrade ladders in the same order as the infrastructure status cards and opens a confirmation modal before upgrading", () => {
    const { state, dcId } = stateWithDatacenterAndRack();
    const { store } = renderPowerView(state, dcId);

    expect(screen.getByText("UPGRADE TRACKS")).toBeTruthy();
    expect(screen.getByText(/FABRIC LOCKED/)).toBeTruthy();
    expect(
      screen.getAllByText(/^(Onsite generation|Cooling loop|Network uplink)$/i).map((node) => node.textContent),
    ).toEqual(["Onsite generation", "Cooling loop", "Network uplink"]);

    const networkLadder = screen.getByRole("list", { name: /Network uplink upgrade ladder/i });
    expect(within(networkLadder).getByText(/Cat6 uplink/i)).toBeTruthy();
    expect(within(networkLadder).getByText(/Cat8 uplink/i)).toBeTruthy();
    expect(within(networkLadder).getByText(/Fiber uplink/i)).toBeTruthy();
    expect(within(networkLadder).getByText("Current")).toBeTruthy();
    expect(within(networkLadder).getByText("Ready next")).toBeTruthy();
    expect(within(networkLadder).getByText("Locked")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Review Hybrid cooling/i }));

    expect(screen.getByRole("dialog", { name: /REVIEW UPGRADE PURCHASE/i })).toBeTruthy();
    expect(screen.getByText(/Cooling loop · Air cooling → Hybrid cooling/i)).toBeTruthy();
    expect(screen.getByText(/Spend required right now to unlock Hybrid cooling/i)).toBeTruthy();
    expect(store.getState().datacenters.find((dc) => dc.id === dcId)?.upgrades?.currentNodeByTrack.cooling).toBe("air");
  });

  it("cancels upgrade confirmation without mutating datacenter upgrades", () => {
    const { state, dcId } = stateWithDatacenterAndRack();
    const { store } = renderPowerView(state, dcId);

    fireEvent.click(screen.getByRole("button", { name: /Review Hybrid cooling/i }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(screen.queryByRole("dialog", { name: /REVIEW UPGRADE PURCHASE/i })).toBeNull();
    expect(screen.getByRole("button", { name: /Review Hybrid cooling/i })).toBeTruthy();
    expect(store.getState().datacenters.find((dc) => dc.id === dcId)?.upgrades?.currentNodeByTrack.cooling).toBe("air");
  });

  it("confirms the selected upgrade from the modal", () => {
    const { state, dcId } = stateWithDatacenterAndRack();
    const { store } = renderPowerView(state, dcId);

    fireEvent.click(screen.getByRole("button", { name: /Review Hybrid cooling/i }));
    fireEvent.click(screen.getByRole("button", { name: /Apply upgrade · \$180,000/i }));

    expect(screen.queryByRole("dialog", { name: /REVIEW UPGRADE PURCHASE/i })).toBeNull();
    expect(screen.getAllByText(/HYBRID/).length).toBeGreaterThan(0);
    expect(screen.getByText(/UPKEEP \$900\/mo/)).toBeTruthy();
    expect(screen.getByText("MAXED")).toBeTruthy();
    expect(store.getState().datacenters.find((dc) => dc.id === dcId)?.upgrades?.currentNodeByTrack.cooling).toBe("hybrid");
  });

  it("shows insufficient-funds copy and disables unaffordable upgrade review actions", () => {
    const { state: builtState, dcId } = stateWithDatacenterAndRack();
    const state: GameState = {
      ...builtState,
      player: {
        ...builtState.player,
        cash: 100_000,
      },
    };

    renderPowerView(state, dcId);

    expect(screen.getByText(/Short \$80,000\. This step costs \$180,000 upfront\./i)).toBeTruthy();
    const upgradeButton = screen.getByRole("button", { name: /Short \$80,000 · Hybrid cooling/i }) as HTMLButtonElement;
    expect(upgradeButton.disabled).toBe(true);
    expect(screen.queryByRole("dialog", { name: /CONFIRM UPGRADE/i })).toBeNull();
  });

  it("shows completed ladder nodes for already-upgraded tracks", () => {
    const { state: builtState, dcId } = stateWithDatacenterAndRack();
    const state = upgradeDatacenterToFiber(builtState, dcId);

    renderPowerView(state, dcId);

    const networkLadder = screen.getByRole("list", { name: /Network uplink upgrade ladder/i });
    expect(within(networkLadder).getAllByText("Complete")).toHaveLength(2);
    expect(within(networkLadder).getByText("Current")).toBeTruthy();
    expect(within(networkLadder).queryByText("Ready next")).toBeNull();
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
