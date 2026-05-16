import { useMemo, useState } from "react";
import type { Region, RegionId } from "@datacenter-tycoon/game-logic";
import styles from "./RegionTable.module.css";

type SortKey = "code" | "city" | "name" | "powerCost" | "power" | "staff" | "tax";
type SortDirection = "asc" | "desc";

interface RegionTableProps {
  regions: Region[];
  selectedRegionId: RegionId | null;
  onSelectRegion: (id: RegionId) => void;
}

interface ColumnDefinition {
  key: SortKey;
  label: string;
  align?: "left" | "right";
  getValue: (region: Region) => string | number;
  render: (region: Region) => string;
}

const COLUMNS: ColumnDefinition[] = [
  {
    key: "code",
    label: "Code",
    getValue: (region) => region.code,
    render: (region) => region.code,
  },
  {
    key: "city",
    label: "City",
    getValue: (region) => region.city,
    render: (region) => region.city,
  },
  {
    key: "name",
    label: "Region",
    getValue: (region) => region.name,
    render: (region) => region.name,
  },
  {
    key: "powerCost",
    label: "Cost / kWh",
    align: "right",
    getValue: (region) => region.powerCostPerKwh,
    render: (region) => `$${region.powerCostPerKwh.toFixed(3)}`,
  },
  {
    key: "power",
    label: "Power",
    align: "right",
    getValue: (region) => region.totalPowerAvailable,
    render: (region) => `${region.totalPowerAvailable.toLocaleString()} kW`,
  },
  {
    key: "staff",
    label: "Staff",
    align: "right",
    getValue: (region) => region.totalStaffAvailable,
    render: (region) => region.totalStaffAvailable.toLocaleString(),
  },
  {
    key: "tax",
    label: "Tax",
    align: "right",
    getValue: (region) => region.taxRate,
    render: (region) => formatPercent(region.taxRate),
  },
];

export function RegionTable({ regions, selectedRegionId, onSelectRegion }: RegionTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("powerCost");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const sortedRegions = useMemo(() => {
    const column = COLUMNS.find((entry) => entry.key === sortKey) ?? COLUMNS[0]!;
    const directionFactor = sortDirection === "asc" ? 1 : -1;

    return [...regions].sort((left, right) => {
      const leftValue = column.getValue(left);
      const rightValue = column.getValue(right);

      if (typeof leftValue === "number" && typeof rightValue === "number") {
        if (leftValue !== rightValue) {
          return (leftValue - rightValue) * directionFactor;
        }
      } else {
        const comparison = String(leftValue).localeCompare(String(rightValue), undefined, {
          sensitivity: "base",
        });
        if (comparison !== 0) {
          return comparison * directionFactor;
        }
      }

      return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    });
  }, [regions, sortDirection, sortKey]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection(key === "power" || key === "staff" ? "desc" : "asc");
  };

  return (
    <div className={styles.shell}>
      <table className={styles.table}>
        <caption className="sr-only">Economic comparison of all regions</caption>
        <thead>
          <tr>
            {COLUMNS.map((column) => {
              const isActive = column.key === sortKey;
              const ariaSort = isActive
                ? sortDirection === "asc"
                  ? "ascending"
                  : "descending"
                : "none";

              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={ariaSort}
                  className={column.align === "right" ? styles.numericHead : undefined}
                >
                  <button
                    type="button"
                    className={[styles.sortButton, isActive ? styles.sortButtonActive : ""].join(" ")}
                    onClick={() => handleSort(column.key)}
                  >
                    <span>{column.label}</span>
                    <span className={styles.sortGlyph} aria-hidden="true">
                      {isActive ? (sortDirection === "asc" ? "▲" : "▼") : "·"}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRegions.map((region) => {
            const isSelected = region.id === selectedRegionId;

            return (
              <tr
                key={region.id}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={`Select region row ${region.code} — ${region.city}, ${region.name}`}
                className={[styles.row, isSelected ? styles.rowSelected : ""].join(" ")}
                onClick={() => onSelectRegion(region.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectRegion(region.id);
                  }
                }}
              >
                {COLUMNS.map((column) => (
                  <td
                    key={column.key}
                    className={column.align === "right" ? styles.numericCell : undefined}
                  >
                    {column.render(region)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatPercent(value: number): string {
  const percent = value * 100;
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(1)}%`;
}
