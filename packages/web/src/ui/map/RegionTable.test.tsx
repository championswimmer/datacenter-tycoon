import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DATACENTER_CATALOG, type Datacenter, type Region, type RegionId } from "@datacenter-tycoon/game-logic";
import { RegionTable } from "./RegionTable.js";

const regionId = (value: string): RegionId => value as RegionId;

const regions: Region[] = [
  {
    id: regionId("us_east"),
    code: "IAD",
    city: "Ashburn",
    name: "US East",
    coordinates: { x: 24, y: 35.5 },
    powerCostPerKwh: 0.08,
    staffWage: 6500,
    taxRate: 0.06,
    totalPowerAvailable: 10000,
    totalStaffAvailable: 800,
    powerUsed: 0,
    staffUsed: 0,
  },
  {
    id: regionId("us_west"),
    code: "PDX",
    city: "Boardman",
    name: "US West",
    coordinates: { x: 15, y: 33 },
    powerCostPerKwh: 0.06,
    staffWage: 6175,
    taxRate: 0.07,
    totalPowerAvailable: 8000,
    totalStaffAvailable: 400,
    powerUsed: 0,
    staffUsed: 0,
  },
  {
    id: regionId("eu_west"),
    code: "DUB",
    city: "Dublin",
    name: "EU West",
    coordinates: { x: 44, y: 26 },
    powerCostPerKwh: 0.18,
    staffWage: 5850,
    taxRate: 0.125,
    totalPowerAvailable: 5000,
    totalStaffAvailable: 350,
    powerUsed: 0,
    staffUsed: 0,
  },
];

const datacenters: Datacenter[] = [
  {
    id: "dc-ashburn-a" as Datacenter["id"],
    name: "Ashburn Alpha",
    spec: DATACENTER_CATALOG.garage!,
    placements: [],
    builtAtTick: 3 as Datacenter["builtAtTick"],
    regionId: regionId("us_east"),
    maintenanceStaff: 0,
  },
  {
    id: "dc-ashburn-b" as Datacenter["id"],
    name: "Ashburn Beta",
    spec: DATACENTER_CATALOG.warehouse!,
    placements: [],
    builtAtTick: 9 as Datacenter["builtAtTick"],
    regionId: regionId("us_east"),
    maintenanceStaff: 0,
  },
  {
    id: "dc-dublin" as Datacenter["id"],
    name: "Dublin Docklands",
    spec: DATACENTER_CATALOG.garage!,
    placements: [],
    builtAtTick: 14 as Datacenter["builtAtTick"],
    regionId: regionId("eu_west"),
    maintenanceStaff: 0,
  },
];

describe("RegionTable", () => {
  it("sorts string columns in ascending then descending order", () => {
    const { container } = render(
      <RegionTable regions={regions} datacenters={[]} selectedRegionId={null} onSelectRegion={() => {}} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /City/i }));
    expect(getCodes(container)).toEqual(["IAD", "PDX", "DUB"]);

    fireEvent.click(screen.getByRole("button", { name: /City/i }));
    expect(getCodes(container)).toEqual(["DUB", "PDX", "IAD"]);
  });

  it("sorts numeric columns using their numeric values", () => {
    const { container } = render(
      <RegionTable regions={regions} datacenters={[]} selectedRegionId={null} onSelectRegion={() => {}} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Power Cap/i }));
    expect(getCodes(container)).toEqual(["IAD", "PDX", "DUB"]);

    fireEvent.click(screen.getByRole("button", { name: /Power Cap/i }));
    expect(getCodes(container)).toEqual(["DUB", "PDX", "IAD"]);
  });

  it("forwards row selection and marks the active row", () => {
    const onSelectRegion = vi.fn();

    render(
      <RegionTable
        regions={regions}
        datacenters={datacenters}
        selectedRegionId={regionId("us_west")}
        onSelectRegion={onSelectRegion}
      />,
    );

    const selectedRow = screen.getByRole("button", {
      name: "Select region row PDX — Boardman, US West",
    });
    expect(selectedRow.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Select region row IAD — Ashburn, US East",
      }),
    );

    expect(onSelectRegion).toHaveBeenCalledWith(regionId("us_east"));
  });

  it("renders regional labor and OpEx profile columns", () => {
    render(
      <RegionTable regions={regions} datacenters={[]} selectedRegionId={null} onSelectRegion={() => {}} />,
    );

    expect(screen.getByText("$6,500")).toBeTruthy();
    expect(screen.getByText("Power 2.25x / Labor 0.90x")).toBeTruthy();
  });

  it("expands datacenter details beneath regions that already host facilities", () => {
    const onSelectRegion = vi.fn();

    render(
      <RegionTable
        regions={regions}
        datacenters={datacenters}
        selectedRegionId={null}
        onSelectRegion={onSelectRegion}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Expand datacenters in US East" }));

    expect(screen.getByText("Datacenters in US East")).toBeTruthy();
    expect(screen.getByText("Ashburn Alpha")).toBeTruthy();
    expect(screen.getByText("Ashburn Beta")).toBeTruthy();
    expect(onSelectRegion).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Collapse datacenters in US East" }));

    expect(screen.queryByText("Datacenters in US East")).toBeNull();
  });
});

function getCodes(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("[data-region-code]"))
    .map((cell) => cell.textContent ?? "")
    .filter(Boolean);
}
