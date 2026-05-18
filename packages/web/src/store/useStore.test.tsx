import React from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { newGame } from "@datacenter-tycoon/game-logic";
import { createGameStore } from "./gameStore.js";
import { StoreProvider, useSelector } from "./storeContext.js";
import { selectRegionById } from "./selectors.js";

function SelectorClosureProbe() {
  const regionIds = useSelector((state) => state.map.regions.slice(0, 2).map((region) => region.id));
  const [primaryRegionId, secondaryRegionId] = regionIds;
  const [selectedRegionId, setSelectedRegionId] = React.useState(primaryRegionId!);
  const selectedRegion = useSelector((state) => selectRegionById(state, selectedRegionId!) ?? null);

  return (
    <div>
      <div data-testid="selected-region-name">{selectedRegion?.name ?? "none"}</div>
      <button type="button" onClick={() => setSelectedRegionId(secondaryRegionId!)}>
        switch region
      </button>
    </div>
  );
}

describe("useGameSelector", () => {
  it("recomputes when the selector closure changes across local rerenders", () => {
    const store = createGameStore(newGame(42));

    render(
      <StoreProvider store={store}>
        <SelectorClosureProbe />
      </StoreProvider>,
    );

    const [firstRegion, secondRegion] = store.getState().map.regions;
    expect(screen.getByTestId("selected-region-name").textContent).toBe(firstRegion?.name);

    fireEvent.click(screen.getByRole("button", { name: "switch region" }));

    expect(screen.getByTestId("selected-region-name").textContent).toBe(secondRegion?.name);
  });
});
