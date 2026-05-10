import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RACK_CATALOG } from "@datacenter-tycoon/game-logic";
import type { RackPlacement } from "@datacenter-tycoon/game-logic";
import type { RackMaintenanceView } from "../../store/selectors.js";
import { RackTile } from "./RackTile.js";
import { nextRackPlacementId } from "../../store/ids.js";

function makePlacement(specId = "C1", row = 0, position = 0): RackPlacement {
  return {
    id: nextRackPlacementId(),
    specId: specId as RackPlacement["specId"],
    kind: "compute",
    installedAtTick: 0,
    health: "healthy",
    row,
    position,
  };
}

function makeMaintenanceView(overrides: Partial<RackMaintenanceView> = {}): RackMaintenanceView {
  return {
    placementId: nextRackPlacementId(),
    ageMonths: 6,
    status: "healthy",
    repairProgressDays: 0,
    repairCompletionPercent: 0,
    repairEtaTicks: 0,
    failureProbability: 0.01,
    ...overrides,
  };
}

describe("RackTile", () => {
  it("renders the spec ID badge", () => {
    const spec = RACK_CATALOG["C1"]!;
    render(
        <RackTile
          placement={makePlacement("C1")}
          maintenanceView={makeMaintenanceView()}
          spec={spec}
          hasActiveContract={false}
          hasFault={false}
          onDecommission={vi.fn()}
          onMove={vi.fn()}
      />,
    );
    expect(screen.getByText("C1")).toBeTruthy();
  });

  it("renders the kind badge CPU for compute racks", () => {
    const spec = RACK_CATALOG["C1"]!;
    render(
        <RackTile
          placement={makePlacement("C1")}
          maintenanceView={makeMaintenanceView()}
          spec={spec}
          hasActiveContract={false}
          hasFault={false}
          onDecommission={vi.fn()}
          onMove={vi.fn()}
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
          maintenanceView={makeMaintenanceView()}
          spec={spec}
          hasActiveContract={false}
          hasFault={false}
          onDecommission={vi.fn()}
          onMove={vi.fn()}
      />,
    );
    expect(screen.getByText("MEM")).toBeTruthy();
  });

  it("shows confirm UI when decommission button is clicked", () => {
    const spec = RACK_CATALOG["C1"]!;
    render(
        <RackTile
          placement={makePlacement("C1")}
          maintenanceView={makeMaintenanceView()}
          spec={spec}
          hasActiveContract={false}
          hasFault={false}
          onDecommission={vi.fn()}
          onMove={vi.fn()}
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
          maintenanceView={makeMaintenanceView()}
          spec={spec}
          hasActiveContract={false}
          hasFault={false}
          onDecommission={onDecommission}
          onMove={vi.fn()}
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
          maintenanceView={makeMaintenanceView()}
          spec={spec}
          hasActiveContract={false}
          hasFault={false}
          onDecommission={vi.fn()}
          onMove={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText(/Decommission/));
    fireEvent.click(screen.getByText("NO"));
    // Confirm UI should be gone; tile renders CPU badge again
    expect(screen.getByText("CPU")).toBeTruthy();
  });

  it("renders rack age and healthy status text", () => {
    const spec = RACK_CATALOG["C1"]!;
    render(
      <RackTile
        placement={makePlacement("C1")}
        maintenanceView={makeMaintenanceView({ ageMonths: 9, status: "healthy" })}
        spec={spec}
        hasActiveContract={false}
        hasFault={false}
        onDecommission={vi.fn()}
        onMove={vi.fn()}
      />,
    );

    expect(screen.getByText("HEALTHY")).toBeTruthy();
    expect(screen.getByText("IDLE BASELINE")).toBeTruthy();
    expect(screen.getByText("AGE 9 MO")).toBeTruthy();
  });

  it("shows ACTIVE LOAD when rack activity reports active", () => {
    const spec = RACK_CATALOG["C1"]!;
    render(
      <RackTile
        placement={makePlacement("C1")}
        maintenanceView={makeMaintenanceView({ status: "healthy" })}
        rackActivity={{
          placementId: makePlacement("C1").id,
          specId: spec.id,
          kind: spec.kind,
          status: "active",
          reservedPowerKw: spec.powerDrawKw,
          billedPowerKw: spec.powerDrawKw,
        }}
        spec={spec}
        hasActiveContract={false}
        hasFault={false}
        onDecommission={vi.fn()}
        onMove={vi.fn()}
      />,
    );

    expect(screen.getByText("ACTIVE LOAD")).toBeTruthy();
  });

  it("renders repair progress and eta for repairing racks", () => {
    const spec = RACK_CATALOG["C1"]!;
    render(
      <RackTile
        placement={{ ...makePlacement("C1"), health: "repairing", repairProgressDays: 45 }}
        maintenanceView={makeMaintenanceView({
          status: "repairing",
          repairProgressDays: 45,
          repairCompletionPercent: 50,
          repairEtaTicks: 2,
        })}
        spec={spec}
        hasActiveContract={false}
        hasFault={true}
        onDecommission={vi.fn()}
        onMove={vi.fn()}
      />,
    );

    expect(screen.getByText("REPAIRING")).toBeTruthy();
    expect(screen.getByText("UNAVAILABLE")).toBeTruthy();
    expect(screen.getByText("50% • ETA 2 mo")).toBeTruthy();
  });

  it("calls onMove when move button is clicked", () => {
    const onMove = vi.fn();
    const spec = RACK_CATALOG["C1"]!;
    const placement = makePlacement("C1");
    render(
      <RackTile
        placement={placement}
        maintenanceView={makeMaintenanceView()}
        spec={spec}
        hasActiveContract={false}
        hasFault={false}
        onDecommission={vi.fn()}
        onMove={onMove}
      />,
    );
    fireEvent.click(screen.getByLabelText(/Move/));
    expect(onMove).toHaveBeenCalledWith(placement.id);
  });

  it("shows FAIL RISK percentage for a healthy rack", () => {
    const spec = RACK_CATALOG["C1"]!;
    render(
      <RackTile
        placement={makePlacement("C1")}
        maintenanceView={makeMaintenanceView({ status: "healthy", failureProbability: 0.025 })}
        spec={spec}
        hasActiveContract={false}
        hasFault={false}
        onDecommission={vi.fn()}
        onMove={vi.fn()}
      />,
    );
    // Should show risk as percentage/month label
    expect(screen.getByText(/FAIL RISK 2\.5%\/MO/)).toBeTruthy();
  });

  it("shows FAIL RISK PAUSED for a repairing rack", () => {
    const spec = RACK_CATALOG["C1"]!;
    render(
      <RackTile
        placement={{ ...makePlacement("C1"), health: "repairing", repairProgressDays: 45 }}
        maintenanceView={makeMaintenanceView({
          status: "repairing",
          repairProgressDays: 45,
          repairCompletionPercent: 50,
          repairEtaTicks: 2,
          failureProbability: 0,
        })}
        spec={spec}
        hasActiveContract={false}
        hasFault={false}
        onDecommission={vi.fn()}
        onMove={vi.fn()}
      />,
    );
    expect(screen.getByText("FAIL RISK PAUSED")).toBeTruthy();
  });
});
