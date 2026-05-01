import { RACK_CATALOG } from "@datacenter-tycoon/game-logic";
import type {
  Datacenter,
  RackPlacement,
  RackPlacementId,
} from "@datacenter-tycoon/game-logic";
import { Slot } from "./Slot.js";
import styles from "./Grid.module.css";

export interface GridProps {
  datacenter:        Datacenter;
  hasActiveContract: boolean;
  hasFault:          boolean;
  onSlotClick:       (row: number, position: number) => void;
  onDecommission:    (placementId: RackPlacementId) => void;
}

export function Grid({
  datacenter,
  hasActiveContract,
  hasFault,
  onSlotClick,
  onDecommission,
}: GridProps) {
  const { rows, positionsPerRow } = datacenter.spec;

  // Build a fast lookup: "row,pos" → placement
  const placementMap = new Map<string, RackPlacement>();
  for (const p of datacenter.placements) {
    placementMap.set(`${p.row},${p.position}`, p);
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
              return (
                <Slot
                  key={p}
                  row={r}
                  position={p}
                  placement={placement}
                  spec={spec}
                  hasActiveContract={hasActiveContract}
                  hasFault={hasFault}
                  onOpenPicker={onSlotClick}
                  onDecommission={onDecommission}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
