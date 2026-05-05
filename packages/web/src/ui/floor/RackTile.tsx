import { useState } from "react";
import type { RackPlacement, RackSpec } from "@datacenter-tycoon/game-logic";
import type { RackMaintenanceView } from "../../store/selectors.js";
import { LedSegment } from "../../theme/primitives/index.js";
import styles from "./RackTile.module.css";

export interface RackTileProps {
  placement:         RackPlacement;
  maintenanceView:   RackMaintenanceView;
  spec:              RackSpec;
  /** True when at least one active (non-breached) contract is running on this DC. */
  hasActiveContract: boolean;
  /** True when at least one contract assigned to this DC is breached. */
  hasFault:          boolean;
  onDecommission:    (placementId: RackPlacement["id"]) => void;
  onMove:            (placementId: RackPlacement["id"]) => void;
  layoutMode?:       "desktop" | "phone";
}

const KIND_LABEL: Record<RackSpec["kind"], string> = {
  compute: "CPU",
  memory:  "MEM",
  storage: "SSD",
  gpu:     "GPU",
};

// 6 blade stripes for the visual stack
const BLADE_COUNT = 6;

export function RackTile({
  placement,
  maintenanceView,
  spec,
  hasActiveContract,
  hasFault,
  onDecommission,
  onMove,
  layoutMode = "desktop",
}: RackTileProps) {
  const [confirming, setConfirming] = useState(false);
  const repairStatusLabel = maintenanceView.status === "repairing" ? "REPAIRING" : "HEALTHY";
  const repairProgressLabel = maintenanceView.status === "repairing"
    ? `${maintenanceView.repairCompletionPercent}% • ETA ${maintenanceView.repairEtaTicks} mo`
    : undefined;

  if (confirming) {
    return (
      <div className={[
        styles.tile,
        layoutMode === "phone" ? styles.tilePhone : "",
        styles[`kind-${spec.kind}`],
        styles.tileConfirm,
      ].join(" ")}>
        <p className={styles.confirmMsg}>Decommission?</p>
        <div className={styles.confirmBtns}>
          <button
            className={styles.confirmYes}
            onClick={() => onDecommission(placement.id)}
          >YES</button>
          <button
            className={styles.confirmNo}
            onClick={() => setConfirming(false)}
          >NO</button>
        </div>
      </div>
    );
  }

  return (
      <div
        className={[
          styles.tile,
          layoutMode === "phone" ? styles.tilePhone : "",
          styles[`kind-${spec.kind}`],
          maintenanceView.status === "repairing" ? styles.tileRepairing : "",
        ].join(" ")}
      title={`${spec.name} — Tier ${spec.tier}\nAge: ${maintenanceView.ageMonths} mo\nStatus: ${repairStatusLabel}${repairProgressLabel ? `\nRepair: ${repairProgressLabel}` : ""}\nCapex: $${spec.capexCost.toLocaleString()}\nPower: ${spec.powerDrawKw} kW/mo`}
    >
      {/* ── Bezel ── */}
      <div className={styles.bezel}>
        <div className={styles.tierPips}>
          {Array.from({ length: spec.tier }, (_, i) => (
            <span key={i} className={styles.pip} />
          ))}
        </div>
        <span className={styles.specId}>{spec.id}</span>
      </div>

      {/* ── Blade stripes ── */}
      <div className={styles.blades}>
        {Array.from({ length: BLADE_COUNT }, (_, i) => (
          <div key={i} className={styles.blade} />
        ))}
      </div>

      {/* ── LED row + kind badge ── */}
      <div className={styles.ledRow}>
        <LedSegment color="cyan"                                      size={5} />
        <LedSegment color={hasActiveContract ? "lime" : "off"}
                    blink={hasActiveContract}                          size={5} />
        <LedSegment color={hasFault ? "red" : "off"}                  size={5} />
        <span className={styles.kindBadge}>{KIND_LABEL[spec.kind]}</span>
      </div>

      <div className={styles.statusRow}>
        <span
          className={[
            styles.statusBadge,
            maintenanceView.status === "repairing" ? styles.statusRepairing : styles.statusHealthy,
          ].join(" ")}
        >
          {repairStatusLabel}
        </span>
        <span className={styles.ageText}>AGE {maintenanceView.ageMonths} MO</span>
      </div>

      {repairProgressLabel && (
        <div className={styles.repairText}>{repairProgressLabel}</div>
      )}

      {/* ── Move trigger ── */}
      <button
        className={styles.moveBtn}
        onClick={() => onMove(placement.id)}
        title="Move rack to another datacenter"
        aria-label={`Move ${spec.name}`}
      >⇄</button>

      {/* ── Decommission trigger ── */}
      <button
        className={styles.decommBtn}
        onClick={() => setConfirming(true)}
        title="Decommission rack"
        aria-label={`Decommission ${spec.name}`}
      >×</button>
    </div>
  );
}
