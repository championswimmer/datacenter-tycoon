import { useEffect, useRef } from "react";
import type { DatacenterUpgradeTrackView, Money } from "@datacenter-tycoon/game-logic";
import { useDialogFocus } from "../dialogFocus.js";
import styles from "./UpgradeConfirmationModal.module.css";

interface UpgradeConfirmationModalProps {
  track: DatacenterUpgradeTrackView;
  cash: Money;
  canAfford: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function formatMoney(value: number): string {
  return `$${value.toLocaleString()}`;
}

function formatSignedMoney(value: number): string {
  return `${value >= 0 ? "+" : "-"}$${Math.abs(value).toLocaleString()}`;
}

export function UpgradeConfirmationModal({
  track,
  cash,
  canAfford,
  onClose,
  onConfirm,
}: UpgradeConfirmationModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useDialogFocus(closeButtonRef);

  const nextNode = track.nextNode;
  if (!nextNode) {
    return null;
  }

  const resultingCash = cash - nextNode.capexCost;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className={styles.backdrop}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-confirmation-title"
      >
        <div className={styles.header}>
          <div className={styles.headerCopy}>
            <h2 id="upgrade-confirmation-title" className={styles.title}>CONFIRM UPGRADE</h2>
            <p className={styles.subtitle}>{track.label} · {track.currentNode.label} → {nextNode.label}</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className={styles.content}>
          <p className={styles.copy}>
            Review the spend before applying this datacenter infrastructure upgrade. The capex is charged immediately and the new upkeep starts after the upgrade lands.
          </p>

          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>TRACK</span>
              <span className={styles.summaryValue}>{track.label}</span>
              <span className={styles.summaryHint}>{track.currentNodeIndex + 1} of {track.totalNodes} active now</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>CAPEX</span>
              <span className={styles.summaryValue}>{formatMoney(nextNode.capexCost)}</span>
              <span className={styles.summaryHint}>Spend required to unlock {nextNode.label}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>UPKEEP Δ</span>
              <span className={styles.summaryValue}>{formatSignedMoney(nextNode.fixedMonthlyOpexDelta)}/mo</span>
              <span className={styles.summaryHint}>{formatMoney(track.currentNode.fixedMonthlyOpex)} → {formatMoney(nextNode.fixedMonthlyOpex)}/mo</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>CASH AFTER</span>
              <span className={styles.summaryValue}>{formatSignedMoney(resultingCash)}</span>
              <span className={styles.summaryHint}>Current cash {formatMoney(cash)}</span>
            </div>
          </div>

          <div className={styles.transitionRow}>
            <div className={styles.nodeCard}>
              <span className={styles.nodeLabel}>CURRENT NODE</span>
              <strong className={styles.nodeValue}>{track.currentNode.label}</strong>
              <span className={styles.nodeHint}>{track.currentNode.id}</span>
            </div>
            <span className={styles.arrow} aria-hidden="true">→</span>
            <div className={styles.nodeCard}>
              <span className={styles.nodeLabel}>TARGET NODE</span>
              <strong className={styles.nodeValue}>{nextNode.label}</strong>
              <span className={styles.nodeHint}>{nextNode.id}</span>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          {!canAfford && (
            <span className={styles.warning}>This upgrade costs {formatMoney(nextNode.capexCost)} but you only have {formatMoney(cash)}.</span>
          )}
          <div className={styles.actions}>
            <button type="button" className={styles.cancelButton} onClick={onClose}>
              CANCEL
            </button>
            <button
              type="button"
              className={styles.confirmButton}
              onClick={onConfirm}
              disabled={!canAfford}
            >
              CONFIRM — {formatMoney(nextNode.capexCost)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
