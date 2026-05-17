import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DATACENTER_CATALOG, newGame, reduce } from "@datacenter-tycoon/game-logic";

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

function renderRegionPanel(state: ReturnType<typeof newGame>) {
  const store = createGameStore(state);
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
    expect(screen.getByText("Upgrade network to fiber to join the regional fabric.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Create fabric with/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Connect .* to regional fabric/i })).toBeNull();
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
