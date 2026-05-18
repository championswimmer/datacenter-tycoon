import { RACK_CATALOG } from "@datacenter-tycoon/game-logic";
import { useMemo } from "react";
import type {
  Datacenter,
  RackActivityView,
  RackPlacement,
  RackPlacementId,
} from "@datacenter-tycoon/game-logic";
import type { RackMaintenanceView } from "../../store/selectors.js";
import { useIsPhoneViewport } from "../responsive.js";
import { Slot } from "./Slot.js";
import styles from "./Grid.module.css";

export interface GridProps {
  datacenter:        Datacenter;
  rackMaintenanceByPlacementId: Map<RackPlacementId, RackMaintenanceView>;
  rackActivityByPlacementId: Map<RackPlacementId, RackActivityView>;
  hasActiveContract: boolean;
  hasFault:          boolean;
  onSlotClick:       (row: number, position: number) => void;
  onDecommission:    (placementId: RackPlacementId) => void;
  onMove:            (placementId: RackPlacementId) => void;
}

interface GridCoordinate {
  row: number;
  position: number;
  rowLabel: string;
  slotLabel: string;
  key: string;
}

interface GridRowModel {
  row: number;
  rowLabel: string;
  slots: readonly GridCoordinate[];
}

const placementLookupCache = new WeakMap<readonly RackPlacement[], ReadonlyMap<string, RackPlacement>>();
const rowCoordinateCache = new Map<string, readonly GridRowModel[]>();
const columnIndexCache = new Map<number, readonly number[]>();

export function getRackPlacementLookup(
  placements: readonly RackPlacement[],
): ReadonlyMap<string, RackPlacement> {
  const cached = placementLookupCache.get(placements);
  if (cached) {
    return cached;
  }

  const lookup = new Map<string, RackPlacement>();
  for (const placement of placements) {
    lookup.set(`${placement.row},${placement.position}`, placement);
  }
  placementLookupCache.set(placements, lookup);
  return lookup;
}

export function getGridRowModels(rows: number, positionsPerRow: number): readonly GridRowModel[] {
  const cacheKey = `${rows}x${positionsPerRow}`;
  const cached = rowCoordinateCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const rowModels = Array.from({ length: rows }, (_, row) => ({
    row,
    rowLabel: String.fromCharCode(65 + row),
    slots: Array.from({ length: positionsPerRow }, (_, position) => ({
      row,
      position,
      rowLabel: String.fromCharCode(65 + row),
      slotLabel: `Slot ${position + 1}`,
      key: `${row}:${position}`,
    })),
  }));
  rowCoordinateCache.set(cacheKey, rowModels);
  return rowModels;
}

export function getGridColumnIndexes(positionsPerRow: number): readonly number[] {
  const cached = columnIndexCache.get(positionsPerRow);
  if (cached) {
    return cached;
  }

  const columns = Array.from({ length: positionsPerRow }, (_, index) => index);
  columnIndexCache.set(positionsPerRow, columns);
  return columns;
}

export function Grid({
  datacenter,
  rackMaintenanceByPlacementId,
  rackActivityByPlacementId,
  hasActiveContract,
  hasFault,
  onSlotClick,
  onDecommission,
  onMove,
}: GridProps) {
  const { rows, positionsPerRow } = datacenter.spec;
  const isPhoneViewport = useIsPhoneViewport();
  const placementMap = getRackPlacementLookup(datacenter.placements);
  const rowModels = getGridRowModels(rows, positionsPerRow);
  const columnIndexes = getGridColumnIndexes(positionsPerRow);
  const desktopGridStyle = useMemo(
    () => ({ "--cols": positionsPerRow } as React.CSSProperties),
    [positionsPerRow],
  );

  if (isPhoneViewport) {
    return (
      <div className={styles.mobileWrapper}>
        {rowModels.map((rowModel) => (
          <section
            key={rowModel.row}
            className={styles.mobileRowGroup}
            role="group"
            aria-labelledby={`mobile-row-${rowModel.row}`}
          >
            <div id={`mobile-row-${rowModel.row}`} className={styles.mobileRowHeader}>
              <span className={styles.mobileRowLabel}>ROW {rowModel.rowLabel}</span>
              <span className={styles.mobileRowMeta}>{positionsPerRow} slots</span>
            </div>

            <div className={styles.mobileSlotList}>
              {rowModel.slots.map((slot) => {
                const placement = placementMap.get(`${slot.row},${slot.position}`);
                const spec = placement ? RACK_CATALOG[placement.specId] : undefined;
                const maintenanceView = placement
                  ? rackMaintenanceByPlacementId.get(placement.id)
                  : undefined;
                const rackActivityView = placement
                  ? rackActivityByPlacementId.get(placement.id)
                  : undefined;

                return (
                  <div key={slot.key} className={styles.mobileSlotCard}>
                    <div className={styles.mobileSlotLabel}>{slot.slotLabel}</div>
                    <Slot
                      row={slot.row}
                      position={slot.position}
                      placement={placement}
                      spec={spec}
                      maintenanceView={maintenanceView}
                      rackActivityView={rackActivityView}
                      hasActiveContract={hasActiveContract}
                      hasFault={hasFault}
                      onOpenPicker={onSlotClick}
                      onDecommission={onDecommission}
                      onMove={onMove}
                      layoutMode="phone"
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      {/* ── Column headers ── */}
      <div
        className={styles.colHeaders}
        style={desktopGridStyle}
      >
        <div className={styles.corner} />
        {columnIndexes.map((index) => (
          <div key={index} className={styles.colLabel}>{index + 1}</div>
        ))}
      </div>

      {/* ── Row grid ── */}
      <div className={styles.rows}>
        {rowModels.map((rowModel) => (
          <div
            key={rowModel.row}
            className={styles.row}
            style={desktopGridStyle}
          >
            {/* Row label (A, B, C…) */}
            <div className={styles.rowLabel}>
              {rowModel.rowLabel}
            </div>

            {/* Slots */}
            {rowModel.slots.map((slot) => {
              const placement = placementMap.get(`${slot.row},${slot.position}`);
              const spec = placement ? RACK_CATALOG[placement.specId] : undefined;
              const maintenanceView = placement
                ? rackMaintenanceByPlacementId.get(placement.id)
                : undefined;
              const rackActivityView = placement
                ? rackActivityByPlacementId.get(placement.id)
                : undefined;
              return (
                <Slot
                  key={slot.key}
                  row={slot.row}
                  position={slot.position}
                  placement={placement}
                  spec={spec}
                  maintenanceView={maintenanceView}
                  rackActivityView={rackActivityView}
                  hasActiveContract={hasActiveContract}
                  hasFault={hasFault}
                  onOpenPicker={onSlotClick}
                  onDecommission={onDecommission}
                  onMove={onMove}
                  layoutMode="desktop"
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
