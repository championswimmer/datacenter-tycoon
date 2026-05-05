import type { RackPlacement, RackSpec } from "@datacenter-tycoon/game-logic";
import type { RackMaintenanceView } from "../../store/selectors.js";
import { RackTile } from "./RackTile.js";
import styles from "./Slot.module.css";

export interface SlotProps {
  row:               number;
  position:          number;
  placement?:        RackPlacement;
  spec?:             RackSpec;
  maintenanceView?:  RackMaintenanceView;
  hasActiveContract: boolean;
  hasFault:          boolean;
  onOpenPicker:      (row: number, position: number) => void;
  onDecommission:    (placementId: RackPlacement["id"]) => void;
  onMove:            (placementId: RackPlacement["id"]) => void;
  layoutMode?:       "desktop" | "phone";
}

export function Slot({
  row,
  position,
  placement,
  spec,
  maintenanceView,
  hasActiveContract,
  hasFault,
  onOpenPicker,
  onDecommission,
  onMove,
  layoutMode = "desktop",
}: SlotProps) {
  if (placement && spec && maintenanceView) {
    return (
      <div className={[styles.slot, layoutMode === "phone" ? styles.phone : ""].join(" ")}>
        <RackTile
          placement={placement}
          maintenanceView={maintenanceView}
          spec={spec}
          hasActiveContract={hasActiveContract}
          hasFault={hasFault}
          onDecommission={onDecommission}
          onMove={onMove}
          layoutMode={layoutMode}
        />
      </div>
    );
  }

  return (
    <button
      className={[styles.slot, layoutMode === "phone" ? styles.phone : ""].join(" ")}
      onClick={() => onOpenPicker(row, position)}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onOpenPicker(row, position); }}
      title={`Empty slot — Row ${String.fromCharCode(65 + row)}, Position ${position + 1}`}
      aria-label={`Empty slot row ${String.fromCharCode(65 + row)} position ${position + 1} — click to install rack`}
    >
      <span className={styles.emptyPlus}>+</span>
    </button>
  );
}
