import { memo } from "react";
import type { RackActivityView, RackPlacement, RackSpec } from "@datacenter-tycoon/game-logic";
import type { RackMaintenanceView } from "../../store/selectors.js";
import { RackTile } from "./RackTile.js";
import styles from "./Slot.module.css";

export interface SlotProps {
  row:               number;
  position:          number;
  placement?:        RackPlacement;
  spec?:             RackSpec;
  maintenanceView?:  RackMaintenanceView;
  rackActivityView?: RackActivityView;
  hasActiveContract: boolean;
  hasFault:          boolean;
  onOpenPicker:      (row: number, position: number) => void;
  onDecommission:    (placementId: RackPlacement["id"]) => void;
  onMove:            (placementId: RackPlacement["id"]) => void;
  layoutMode?:       "desktop" | "phone";
  slotLabel?:        string;
}

export const Slot = memo(function Slot({
  row,
  position,
  placement,
  spec,
  maintenanceView,
  rackActivityView,
  hasActiveContract,
  hasFault,
  onOpenPicker,
  onDecommission,
  onMove,
  layoutMode = "desktop",
  slotLabel,
}: SlotProps) {
  const className = [
    styles.slot,
    layoutMode === "phone" ? styles.phone : "",
    slotLabel ? styles.phoneLabeled : "",
  ].join(" ");
  const slotTitle = `Empty slot — Row ${String.fromCharCode(65 + row)}, Position ${position + 1}`;
  const slotAriaLabel = `Empty slot row ${String.fromCharCode(65 + row)} position ${position + 1} — click to install rack`;
  if (placement && spec && maintenanceView) {
    return (
      <div className={className} data-slot-label={slotLabel}>
        <RackTile
          placement={placement}
          maintenanceView={maintenanceView}
          rackActivity={rackActivityView}
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
      className={className}
      data-slot-label={slotLabel}
      onClick={() => onOpenPicker(row, position)}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onOpenPicker(row, position); }}
      title={slotTitle}
      aria-label={slotAriaLabel}
    >
      <span className={styles.emptyPlus}>+</span>
    </button>
  );
});
