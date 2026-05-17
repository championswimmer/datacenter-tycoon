import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DATACENTER_CATALOG, RACK_CATALOG, newGame, reduce } from "@datacenter-tycoon/game-logic";
import type { GameState } from "@datacenter-tycoon/game-logic";
import { createGameStore } from "../../store/gameStore.js";
import { StoreProvider } from "../../store/storeContext.js";
import { nextDcId, nextRackPlacementId } from "../../store/ids.js";
import { DatacenterView } from "./DatacenterView.js";

function buildState(): { state: GameState; dcId: ReturnType<typeof nextDcId> } {
  let state = newGame(42);
  const dcId = nextDcId();
  const firstRegionId = state.map.regions[0]!.id;

  state = reduce(state, {
    type: "BuildDatacenter",
    specId: DATACENTER_CATALOG["garage"]!.id,
    dcId,
    regionId: firstRegionId,
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

function renderView(state: GameState, dcId: ReturnType<typeof nextDcId>) {
  const store = createGameStore(state);
  render(
    <StoreProvider store={store}>
      <DatacenterView dcId={dcId} tab="floor" />
    </StoreProvider>,
  );
}

describe("DatacenterView maintenance staffing controls", () => {
  it("shows the datacenter region code, city, and name in the header", () => {
    const { state, dcId } = buildState();

    renderView(state, dcId);

    expect(screen.getByText("IAD · Ashburn · US East")).toBeTruthy();
  });

  it("shows rack activity and billed-vs-reserved power summary badges", () => {
    const { state: builtState, dcId } = buildState();
    const state = reduce(builtState, {
      type: "PlaceRack",
      dcId,
      specId: RACK_CATALOG.C1!.id,
      row: 0,
      position: 0,
      placementId: nextRackPlacementId(),
    });

    renderView(state, dcId);

    expect(screen.getByText(/ACTIVE\s+0/)).toBeTruthy();
    expect(screen.getByText(/IDLE\s+1/)).toBeTruthy();
    expect(screen.getByText(/BILLED/)).toBeTruthy();
    expect(screen.getByText(/RESERVED/)).toBeTruthy();
  });

  it("increases and decreases maintenance staffing from the stepper", () => {
    const { state, dcId } = buildState();
    renderView(state, dcId);

    fireEvent.click(screen.getByLabelText("Increase maintenance staff"));
    expect(screen.getByText("MAINT 1")).toBeTruthy();
    expect(screen.getByText(/Extra wages \$[\d,]+(?:\.\d+)?\/mo/)).toBeTruthy();
    expect(screen.getByText(/repair-days\/day/)).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Decrease maintenance staff"));
    expect(screen.getByText("MAINT 0")).toBeTruthy();
  });

  it("shows upgrade and fabric status badges sourced from canonical selectors", () => {
    const { state: builtState, dcId } = buildState();
    const state = upgradeDatacenterToFiber(builtState, dcId);

    renderView(state, dcId);

    expect(screen.getAllByText(/FABRIC READY/).length).toBeGreaterThan(0);
    expect(screen.getByText(/NETWORK UPLINK: FIBER UPLINK/)).toBeTruthy();
  });

  it("shows linked fabric pool metadata after the regional fabric is created", () => {
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
      state = upgradeDatacenterToFiber(state, dcId);
    }

    state = reduce(state, { type: "FabricLink", sourceDcId: dcA, targetDcId: dcB });

    renderView(state, dcA);

    expect(screen.getByText(/FABRIC LINKED/)).toBeTruthy();
    expect(screen.getByText(/2 SITES IN POOL/)).toBeTruthy();
  });

  it("disables the increase control when the region has no spare staff", () => {
    const { state, dcId } = buildState();
    const constrainedState = {
      ...state,
      map: {
        ...state.map,
        regions: state.map.regions.map((region) =>
          region.id === state.datacenters[0]!.regionId
            ? {
                ...region,
                totalStaffAvailable: region.staffUsed,
              }
            : region,
        ),
      },
    };

    renderView(constrainedState, dcId);

    expect(screen.getByLabelText("Increase maintenance staff")).toHaveProperty("disabled", true);
    expect(screen.getByText("Regional staff exhausted")).toBeTruthy();
  });
});
