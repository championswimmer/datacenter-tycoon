import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DATACENTER_CATALOG, newGame, reduce } from "@datacenter-tycoon/game-logic";
import type { GameState } from "@datacenter-tycoon/game-logic";
import { createGameStore } from "../../store/gameStore.js";
import { StoreProvider } from "../../store/storeContext.js";
import { nextDcId } from "../../store/ids.js";
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

function renderView(state: GameState, dcId: ReturnType<typeof nextDcId>) {
  const store = createGameStore(state);
  render(
    <StoreProvider store={store}>
      <DatacenterView dcId={dcId} tab="floor" />
    </StoreProvider>,
  );
}

describe("DatacenterView maintenance staffing controls", () => {
  it("increases and decreases maintenance staffing from the stepper", () => {
    const { state, dcId } = buildState();
    const regionWage = state.map.regions.find((region) => region.id === state.datacenters[0]!.regionId)!.staffWage;
    renderView(state, dcId);

    fireEvent.click(screen.getByLabelText("Increase maintenance staff"));
    expect(screen.getByText("MAINT 1")).toBeTruthy();
    expect(screen.getByText(`Extra wages $${regionWage.toLocaleString()}/mo`)).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Decrease maintenance staff"));
    expect(screen.getByText("MAINT 0")).toBeTruthy();
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
