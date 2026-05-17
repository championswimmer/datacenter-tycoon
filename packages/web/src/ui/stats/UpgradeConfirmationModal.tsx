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

function formatDeltaMoney(value: number): string {
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
  const shortfall = Math.max(0, nextNode.capexCost - cash);

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
            <h2 id="upgrade-confirmation-title" className={styles.title}>REVIEW UPGRADE PURCHASE</h2>
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
            You are about to commit capital to the next infrastructure step. Review the upfront spend, the new monthly upkeep, and the cash you will have left before you lock it in.
          </p>

          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>TRACK</span>
              <span className={styles.summaryValue}>{track.label}</span>
              <span className={styles.summaryHint}>Currently at step {track.currentNodeIndex + 1} of {track.totalNodes}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>UPFRONT COST</span>
              <span className={styles.summaryValue}>{formatMoney(nextNode.capexCost)}</span>
              <span className={styles.summaryHint}>Spend required right now to unlock {nextNode.label}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>MONTHLY UPKEEP</span>
              <span className={styles.summaryValue}>{formatDeltaMoney(nextNode.fixedMonthlyOpexDelta)}/mo</span>
              <span className={styles.summaryHint}>{formatMoney(track.currentNode.fixedMonthlyOpex)} → {formatMoney(nextNode.fixedMonthlyOpex)}/mo after the upgrade</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>CASH AFTER PURCHASE</span>
              <span className={styles.summaryValue}>{formatMoney(resultingCash)}</span>
              <span className={styles.summaryHint}>Current cash on hand: {formatMoney(cash)}</span>
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
            <span className={styles.warning}>Short {formatMoney(shortfall)}. Add more cash before applying this upgrade.</span>
          )}
          <div className={styles.actions}>
            <button type="button" className={styles.cancelButton} onClick={onClose}>
              Back
            </button>
            <button
              type="button"
              className={styles.confirmButton}
              onClick={onConfirm}
              disabled={!canAfford}
            >
              Apply upgrade · {formatMoney(nextNode.capexCost)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
