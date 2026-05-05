import { RACK_CATALOG } from "@datacenter-tycoon/game-logic";
import type {
  Datacenter,
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
  hasActiveContract: boolean;
  hasFault:          boolean;
  onSlotClick:       (row: number, position: number) => void;
  onDecommission:    (placementId: RackPlacementId) => void;
  onMove:            (placementId: RackPlacementId) => void;
}

export function Grid({
  datacenter,
  rackMaintenanceByPlacementId,
  hasActiveContract,
  hasFault,
  onSlotClick,
  onDecommission,
  onMove,
}: GridProps) {
  const { rows, positionsPerRow } = datacenter.spec;
  const isPhoneViewport = useIsPhoneViewport();

  // Build a fast lookup: "row,pos" → placement
  const placementMap = new Map<string, RackPlacement>();
  for (const p of datacenter.placements) {
    placementMap.set(`${p.row},${p.position}`, p);
  }

  if (isPhoneViewport) {
    return (
      <div className={styles.mobileWrapper}>
        {Array.from({ length: rows }, (_, r) => (
          <section
            key={r}
            className={styles.mobileRowGroup}
            role="group"
            aria-labelledby={`mobile-row-${r}`}
          >
            <div id={`mobile-row-${r}`} className={styles.mobileRowHeader}>
              <span className={styles.mobileRowLabel}>ROW {String.fromCharCode(65 + r)}</span>
              <span className={styles.mobileRowMeta}>{positionsPerRow} slots</span>
            </div>

            <div className={styles.mobileSlotList}>
              {Array.from({ length: positionsPerRow }, (_, p) => {
                const placement = placementMap.get(`${r},${p}`);
                const spec = placement ? RACK_CATALOG[placement.specId] : undefined;
                const maintenanceView = placement
                  ? rackMaintenanceByPlacementId.get(placement.id)
                  : undefined;

                return (
                  <div key={p} className={styles.mobileSlotCard}>
                    <div className={styles.mobileSlotLabel}>Slot {p + 1}</div>
                    <Slot
                      row={r}
                      position={p}
                      placement={placement}
                      spec={spec}
                      maintenanceView={maintenanceView}
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
        style={{ "--cols": positionsPerRow } as React.CSSProperties}
      >
        <div className={styles.corner} />
        {Array.from({ length: positionsPerRow }, (_, i) => (
          <div key={i} className={styles.colLabel}>{i + 1}</div>
        ))}
      </div>

      {/* ── Row grid ── */}
      <div className={styles.rows}>
        {Array.from({ length: rows }, (_, r) => (
          <div
            key={r}
            className={styles.row}
            style={{ "--cols": positionsPerRow } as React.CSSProperties}
          >
            {/* Row label (A, B, C…) */}
            <div className={styles.rowLabel}>
              {String.fromCharCode(65 + r)}
            </div>

            {/* Slots */}
            {Array.from({ length: positionsPerRow }, (_, p) => {
              const placement = placementMap.get(`${r},${p}`);
              const spec      = placement ? RACK_CATALOG[placement.specId] : undefined;
              const maintenanceView = placement
                ? rackMaintenanceByPlacementId.get(placement.id)
                : undefined;
              return (
                <Slot
                  key={p}
                  row={r}
                  position={p}
                  placement={placement}
                  spec={spec}
                  maintenanceView={maintenanceView}
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
