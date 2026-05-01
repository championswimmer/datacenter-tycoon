import { useState } from "react";
import type { RackPlacement, RackSpec } from "@datacenter-tycoon/game-logic";
import { LedSegment } from "../../theme/primitives/index.js";
import styles from "./RackTile.module.css";

export interface RackTileProps {
  placement:         RackPlacement;
  spec:              RackSpec;
  /** True when at least one active (non-breached) contract is running on this DC. */
  hasActiveContract: boolean;
  /** True when at least one contract assigned to this DC is breached. */
  hasFault:          boolean;
  onDecommission:    (placementId: RackPlacement["id"]) => void;
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
  spec,
  hasActiveContract,
  hasFault,
  onDecommission,
}: RackTileProps) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className={[styles.tile, styles[`kind-${spec.kind}`], styles.tileConfirm].join(" ")}>
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
      className={[styles.tile, styles[`kind-${spec.kind}`]].join(" ")}
      title={`${spec.name} — Tier ${spec.tier}\nCapex: $${spec.capexCost.toLocaleString()}\nPower: ${spec.powerDrawKw} kW/mo`}
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
