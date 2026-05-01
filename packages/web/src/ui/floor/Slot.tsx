import type { RackPlacement, RackSpec } from "@datacenter-tycoon/game-logic";
import { RackTile } from "./RackTile.js";
import styles from "./Slot.module.css";

export interface SlotProps {
  row:               number;
  position:          number;
  placement?:        RackPlacement;
  spec?:             RackSpec;
  hasActiveContract: boolean;
  hasFault:          boolean;
  onOpenPicker:      (row: number, position: number) => void;
  onDecommission:    (placementId: RackPlacement["id"]) => void;
}

export function Slot({
  row,
  position,
  placement,
  spec,
  hasActiveContract,
  hasFault,
  onOpenPicker,
  onDecommission,
}: SlotProps) {
  if (placement && spec) {
    return (
      <div className={styles.slot}>
        <RackTile
          placement={placement}
          spec={spec}
          hasActiveContract={hasActiveContract}
          hasFault={hasFault}
          onDecommission={onDecommission}
        />
      </div>
    );
  }

  return (
    <button
      className={styles.slot}
      onClick={() => onOpenPicker(row, position)}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onOpenPicker(row, position); }}
      title={`Empty slot — Row ${String.fromCharCode(65 + row)}, Position ${position + 1}`}
      aria-label={`Empty slot row ${String.fromCharCode(65 + row)} position ${position + 1} — click to install rack`}
    >
      <span className={styles.emptyPlus}>+</span>
    </button>
  );
}
