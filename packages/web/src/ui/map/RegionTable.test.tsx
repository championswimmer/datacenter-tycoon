import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Region, RegionId } from "@datacenter-tycoon/game-logic";
import { RegionTable } from "./RegionTable.js";

const regionId = (value: string): RegionId => value as RegionId;

const regions: Region[] = [
  {
    id: regionId("us_east"),
    code: "IAD",
    city: "Ashburn",
    name: "US East",
    coordinates: { x: 24, y: 35.5 },
    powerCostPerKwh: 0.07,
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
    powerCostPerKwh: 0.05,
    staffWage: 5800,
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
    powerCostPerKwh: 0.12,
    staffWage: 5200,
    taxRate: 0.125,
    totalPowerAvailable: 5000,
    totalStaffAvailable: 350,
    powerUsed: 0,
    staffUsed: 0,
  },
];

describe("RegionTable", () => {
  it("sorts string columns in ascending then descending order", () => {
    const { container } = render(
      <RegionTable regions={regions} selectedRegionId={null} onSelectRegion={() => {}} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /City/i }));
    expect(getCodes(container)).toEqual(["IAD", "PDX", "DUB"]);

    fireEvent.click(screen.getByRole("button", { name: /City/i }));
    expect(getCodes(container)).toEqual(["DUB", "PDX", "IAD"]);
  });

  it("sorts numeric columns using their numeric values", () => {
    const { container } = render(
      <RegionTable regions={regions} selectedRegionId={null} onSelectRegion={() => {}} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Power/i }));
    expect(getCodes(container)).toEqual(["IAD", "PDX", "DUB"]);

    fireEvent.click(screen.getByRole("button", { name: /Power/i }));
    expect(getCodes(container)).toEqual(["DUB", "PDX", "IAD"]);
  });

  it("forwards row selection and marks the active row", () => {
    const onSelectRegion = vi.fn();

    render(
      <RegionTable
        regions={regions}
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
});

function getCodes(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("tbody tr td:first-child"))
    .map((cell) => cell.textContent ?? "")
    .filter(Boolean);
}
