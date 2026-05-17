import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DATACENTER_CATALOG, newGame, reduce } from "@datacenter-tycoon/game-logic";
import { nextDcId } from "../../store/ids.js";
import { createGameStore } from "../../store/gameStore.js";
import { StoreProvider } from "../../store/storeContext.js";
import { MapView } from "./MapView.js";

function Wrapper({ state = newGame(42) }: { state?: ReturnType<typeof newGame> }) {
  const store = createGameStore(state);
  return (
    <StoreProvider store={store}>
      <MapView />
    </StoreProvider>
  );
}

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

describe("MapView", () => {
  it("renders both the world map and the sortable region table", () => {
    render(<Wrapper />);

    expect(screen.getByText("GLOBAL FOOTPRINT")).toBeTruthy();
    expect(screen.getByText("REGION ECONOMICS")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Select region marker IAD — Ashburn, US East" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Select region row IAD — Ashburn, US East" }),
    ).toBeTruthy();
  });

  it("keeps marker, table row, and region panel selection in sync", () => {
    render(<Wrapper />);

    fireEvent.click(
      screen.getByRole("button", { name: "Select region row FRA — Frankfurt, EU Central" }),
    );

    expect(
      screen.getByRole("button", { name: "Select region marker FRA — Frankfurt, EU Central" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: "Select region row FRA — Frankfurt, EU Central" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByRole("heading", { name: "EU Central" })).toBeTruthy();
    expect(screen.getAllByText("FRA · Frankfurt")).toHaveLength(2);

    fireEvent.click(
      screen.getByRole("button", { name: "Select region marker DXB — Dubai, ME Central" }),
    );

    expect(
      screen.getByRole("button", { name: "Select region row DXB — Dubai, ME Central" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByRole("heading", { name: "ME Central" })).toBeTruthy();
    expect(screen.getAllByText("DXB · Dubai")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "BUILD HERE" })).toBeTruthy();
  });

  it("creates a regional fabric from the region panel and updates the map subtitle", () => {
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

    render(<Wrapper state={state} />);

    fireEvent.click(screen.getByRole("button", { name: "Select region row IAD — Ashburn, US East" }));
    fireEvent.click(screen.getByRole("button", { name: /Create fabric with Garage Datacenter and Garage Datacenter/i }));

    expect(screen.getByText(/1 active fabrics/)).toBeTruthy();
    expect(screen.getByText("ACTIVE")).toBeTruthy();
    expect(screen.getAllByText(/LINKED/).length).toBeGreaterThan(0);
  });
});
