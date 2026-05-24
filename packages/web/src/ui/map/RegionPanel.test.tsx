import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DATACENTER_CATALOG, FabricLinkError, newGame, reduce } from "@datacenter-tycoon/game-logic";

import type { GameStore } from "../../store/gameStore.js";

import { createGameStore } from "../../store/gameStore.js";
import { nextDcId } from "../../store/ids.js";
import { StoreProvider } from "../../store/storeContext.js";
import { RegionPanel } from "./RegionPanel.js";

function upgradeDatacenterToFiber(state: ReturnType<typeof newGame>, dcId: ReturnType<typeof nextDcId>) {
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

function renderRegionPanel(state: ReturnType<typeof newGame>, storeOverride?: GameStore) {
  const store = storeOverride ?? createGameStore(state);
  const region = state.map.regions[0]!;
  return render(
    <StoreProvider store={store}>
      <RegionPanel
        region={region}
        datacenters={state.datacenters}
        onClose={vi.fn()}
        onBuild={vi.fn()}
      />
    </StoreProvider>,
  );
}

describe("RegionPanel", () => {
  it("shows fiber-gated blocked messaging when a datacenter cannot join the regional fabric yet", () => {
    let state = newGame(42, { startingCash: 4_000_000 });
    const dcId = nextDcId();
    const firstRegionId = state.map.regions[0]!.id;

    state = reduce(state, {
      type: "BuildDatacenter",
      specId: DATACENTER_CATALOG.garage!.id,
      dcId,
      regionId: firstRegionId,
    });

    renderRegionPanel(state);

    expect(screen.getByText("REGIONAL FABRIC")).toBeTruthy();
    expect(screen.getByText("INACTIVE")).toBeTruthy();
    expect(screen.getByText("FIBER LOCKED")).toBeTruthy();
    expect(screen.getByText(/Regional OpEx profile:/)).toBeTruthy();
    expect(screen.getByText(/Power 1\.00x \/ Labor 1\.00x/)).toBeTruthy();
    expect(screen.getByText("Upgrade network to fiber to join the regional fabric.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Create fabric with/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Connect .* to regional fabric/i })).toBeNull();
  });

  it("shows an explicit insufficient-funds warning and disables fabric actions when the join cost is unaffordable", () => {
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

    state = {
      ...state,
      player: {
        ...state.player,
        cash: 0,
      },
    };

    renderRegionPanel(state);

    const createButton = screen.getByRole("button", { name: /Create fabric with Garage Datacenter and Garage Datacenter/i });
    expect(createButton.getAttribute("disabled")).not.toBeNull();
    expect(screen.getAllByText(/Need \$150,000 cash to create or extend the regional fabric/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Current cash: \$0/).length).toBeGreaterThan(0);
  });

  it("shows a recoverable inline warning when a fabric link dispatch throws a validation error", () => {
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

    const throwingStore: GameStore = {
      getState: () => state,
      getLastAction: () => null,
      subscribe: () => () => {},
      dispatch: () => {
        throw new FabricLinkError(
          `Datacenters ${dcA} and ${dcB} are already linked to the regional fabric`,
          {
            code: "duplicate_join",
            sourceDcId: dcA,
            targetDcId: dcB,
            regionId: firstRegionId,
          },
        );
      },
    };

    renderRegionPanel(state, throwingStore);

    fireEvent.click(screen.getByRole("button", { name: /Create fabric with Garage Datacenter and Garage Datacenter/i }));

    expect(screen.getByText(new RegExp(`Datacenters ${dcA} and ${dcB} are already linked to the regional fabric`))).toBeTruthy();
  });

  it("creates a regional fabric from the region panel when two fiber-ready datacenters are available", () => {
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

    renderRegionPanel(state);

    fireEvent.click(screen.getByRole("button", { name: /Create fabric with Garage Datacenter and Garage Datacenter/i }));

    expect(screen.getByText("ACTIVE")).toBeTruthy();
    expect(screen.getByText(/2 linked datacenters/)).toBeTruthy();
    expect(screen.getAllByText("LINKED").length).toBeGreaterThan(0);
  });
});
