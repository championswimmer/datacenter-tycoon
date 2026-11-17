import { useEffect } from "react";
import type { DatacenterId } from "@datacenter-tycoon/game-logic";
import { UpgradePanel, type UpgradePanelFocus } from "../stats/UpgradePanel.js";
import styles from "./InfrastructureUpgradeDialog.module.css";

const TITLES: Record<UpgradePanelFocus, string> = {
  power: "⚡ Power Upgrades",
  cooling: "❄ Cooling Upgrades",
  network: "🌐 Network Upgrades",
};

export interface InfrastructureUpgradeDialogProps {
  dcId: DatacenterId;
  focus: UpgradePanelFocus;
  onClose: () => void;
}

/** Focused single-track upgrade dialog (power / cooling / network) opened from 3D equipment and landmarks. */
export function InfrastructureUpgradeDialog({ dcId, focus, onClose }: InfrastructureUpgradeDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <section
        className={styles.dialog}
        role="dialog"
        aria-label={TITLES[focus]}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>{TITLES[focus]}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close Dialog">
            ✕
          </button>
        </div>
        <div className={styles.body}>
          <UpgradePanel dcId={dcId} focus={focus} />
        </div>
      </section>
    </div>
  );
}
