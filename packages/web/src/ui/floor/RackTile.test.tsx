import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RACK_CATALOG } from "@datacenter-tycoon/game-logic";
import type { RackPlacement } from "@datacenter-tycoon/game-logic";
import { RackTile } from "./RackTile.js";
import { nextRackPlacementId } from "../../store/ids.js";

function makePlacement(specId = "C1", row = 0, position = 0): RackPlacement {
  return {
    id: nextRackPlacementId(),
    specId: specId as RackPlacement["specId"],
    kind: "compute",
    installedAtTick: 0,
    row,
    position,
  };
}

describe("RackTile", () => {
  it("renders the spec ID badge", () => {
    const spec = RACK_CATALOG["C1"]!;
    render(
      <RackTile
        placement={makePlacement("C1")}
        spec={spec}
        hasActiveContract={false}
        hasFault={false}
        onDecommission={vi.fn()}
      />,
    );
    expect(screen.getByText("C1")).toBeTruthy();
  });

  it("renders the kind badge CPU for compute racks", () => {
    const spec = RACK_CATALOG["C1"]!;
    render(
      <RackTile
        placement={makePlacement("C1")}
        spec={spec}
        hasActiveContract={false}
        hasFault={false}
        onDecommission={vi.fn()}
      />,
    );
    expect(screen.getByText("CPU")).toBeTruthy();
  });

  it("renders MEM badge for memory rack", () => {
    const spec = RACK_CATALOG["M1"]!;
    const placement = { ...makePlacement("M1"), kind: "memory" as const };
    render(
      <RackTile
        placement={placement}
        spec={spec}
        hasActiveContract={false}
        hasFault={false}
        onDecommission={vi.fn()}
      />,
    );
    expect(screen.getByText("MEM")).toBeTruthy();
  });

  it("shows confirm UI when decommission button is clicked", () => {
    const spec = RACK_CATALOG["C1"]!;
    render(
      <RackTile
        placement={makePlacement("C1")}
        spec={spec}
        hasActiveContract={false}
        hasFault={false}
        onDecommission={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText(/Decommission/));
    expect(screen.getByText("Decommission?")).toBeTruthy();
    expect(screen.getByText("YES")).toBeTruthy();
    expect(screen.getByText("NO")).toBeTruthy();
  });

  it("calls onDecommission when YES is confirmed", () => {
    const onDecommission = vi.fn();
    const spec = RACK_CATALOG["C1"]!;
    const placement = makePlacement("C1");
    render(
      <RackTile
        placement={placement}
        spec={spec}
        hasActiveContract={false}
        hasFault={false}
        onDecommission={onDecommission}
      />,
    );
    fireEvent.click(screen.getByLabelText(/Decommission/));
    fireEvent.click(screen.getByText("YES"));
    expect(onDecommission).toHaveBeenCalledWith(placement.id);
  });

  it("cancels confirm when NO is clicked", () => {
    const spec = RACK_CATALOG["C1"]!;
    render(
      <RackTile
        placement={makePlacement("C1")}
        spec={spec}
        hasActiveContract={false}
        hasFault={false}
        onDecommission={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText(/Decommission/));
    fireEvent.click(screen.getByText("NO"));
    // Confirm UI should be gone; tile renders CPU badge again
    expect(screen.getByText("CPU")).toBeTruthy();
  });
});
