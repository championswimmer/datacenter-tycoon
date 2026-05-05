import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  newGame,
  reduce,
  DATACENTER_CATALOG,
  RACK_CATALOG,
} from "@datacenter-tycoon/game-logic";
import type { RackMaintenanceView } from "../../store/selectors.js";
import { Grid } from "./Grid.js";
import { nextDcId, nextRackPlacementId } from "../../store/ids.js";

function buildState() {
  let state = newGame(42);
  const dcId = nextDcId();
  const firstRegionId = state.map.regions[0]!.id;
  state = reduce(state, {
    type: "BuildDatacenter",
    specId: DATACENTER_CATALOG["garage"]!.id, // 2 rows × 4 positions
    dcId,
    regionId: firstRegionId,
  });
  return { state, dcId };
}

function maintenanceMapFor(
  placements: Array<{ id: RackMaintenanceView["placementId"] }>,
): Map<RackMaintenanceView["placementId"], RackMaintenanceView> {
  return new Map(
    placements.map((placement) => [
      placement.id,
      {
        placementId: placement.id,
        ageMonths: 0,
        status: "healthy",
        repairProgressDays: 0,
        repairCompletionPercent: 0,
        repairEtaTicks: 0,
      },
    ]),
  );
}

describe("Grid", () => {
  it("renders correct number of empty slots for a garage DC (2×4=8)", () => {
    const { state, dcId } = buildState();
    const dc = state.datacenters.find(d => d.id === dcId)!;
    render(
      <Grid
        datacenter={dc}
        rackMaintenanceByPlacementId={maintenanceMapFor(dc.placements)}
        hasActiveContract={false}
        hasFault={false}
        onSlotClick={vi.fn()}
        onDecommission={vi.fn()}
        onMove={vi.fn()}
      />,
    );
    // 2 rows × 4 positions = 8 empty slot buttons
    const slots = screen.getAllByRole("button");
    expect(slots).toHaveLength(8);
  });

  it("renders row labels A and B", () => {
    const { state, dcId } = buildState();
    const dc = state.datacenters.find(d => d.id === dcId)!;
    render(
      <Grid
        datacenter={dc}
        rackMaintenanceByPlacementId={maintenanceMapFor(dc.placements)}
        hasActiveContract={false}
        hasFault={false}
        onSlotClick={vi.fn()}
        onDecommission={vi.fn()}
        onMove={vi.fn()}
      />,
    );
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByText("B")).toBeTruthy();
  });

  it("renders column labels 1–4", () => {
    const { state, dcId } = buildState();
    const dc = state.datacenters.find(d => d.id === dcId)!;
    render(
      <Grid
        datacenter={dc}
        rackMaintenanceByPlacementId={maintenanceMapFor(dc.placements)}
        hasActiveContract={false}
        hasFault={false}
        onSlotClick={vi.fn()}
        onDecommission={vi.fn()}
        onMove={vi.fn()}
      />,
    );
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
  });

  it("calls onSlotClick with correct row+position when empty slot is clicked", () => {
    const { state, dcId } = buildState();
    const dc = state.datacenters.find(d => d.id === dcId)!;
    const handler = vi.fn();
    render(
      <Grid
        datacenter={dc}
        rackMaintenanceByPlacementId={maintenanceMapFor(dc.placements)}
        hasActiveContract={false}
        hasFault={false}
        onSlotClick={handler}
        onDecommission={vi.fn()}
        onMove={vi.fn()}
      />,
    );
    // Click first empty slot (row 0, position 0)
    fireEvent.click(screen.getAllByRole("button")[0]!);
    expect(handler).toHaveBeenCalledWith(0, 0);
  });

  it("renders a RackTile (no + button) for a filled slot", () => {
    const { state: s0, dcId } = buildState();
    const placementId = nextRackPlacementId();
    const state = reduce(s0, {
      type: "PlaceRack",
      dcId,
      specId: RACK_CATALOG["C1"]!.id,
      row: 0,
      position: 0,
      placementId,
    });
    const dc = state.datacenters.find(d => d.id === dcId)!;
    render(
      <Grid
        datacenter={dc}
        rackMaintenanceByPlacementId={maintenanceMapFor(dc.placements)}
        hasActiveContract={false}
        hasFault={false}
        onSlotClick={vi.fn()}
        onDecommission={vi.fn()}
        onMove={vi.fn()}
      />,
    );
    // 1 filled slot → only 7 empty buttons (+ 1 decommission button inside the tile = 8 total)
    const emptySlots = screen.getAllByRole("button").filter(
      btn => btn.getAttribute("aria-label")?.includes("click to install"),
    );
    expect(emptySlots).toHaveLength(7);
  });
});
