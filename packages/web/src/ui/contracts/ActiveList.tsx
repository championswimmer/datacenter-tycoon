import { useCallback, useState } from "react";
import { DAYS_PER_TICK } from "@datacenter-tycoon/game-logic";
import type { Contract, ContractStatus } from "@datacenter-tycoon/game-logic";
import { useSelector, useGameDispatch } from "../../store/storeContext.js";
import {
  selectActiveContractViews,
  selectSubtick,
  selectTick,
} from "../../store/selectors.js";
import { ProgressBar } from "../../theme/primitives/index.js";
import { useTickFraction } from "../../store/tickFractionStore.js";
import { monthsAndDaysBetween, formatRemaining } from "../../store/gameTime.js";
import styles from "./ActiveList.module.css";

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

const STATUS_LABEL: Record<ContractStatus, string> = {
  active: "ACTIVE",
  breached: "BREACHED",
  expired: "EXPIRED",
  cancelled: "CANCELLED",
  offered: "OFFERED",
};

const SLA_STATUS_LABEL = {
  recoverable: "RECOVERABLE",
  at_risk: "AT RISK",
  missed: "MISSED",
} as const;

export function ActiveList() {
  const contractViews = useSelector(selectActiveContractViews);
  const tick = useSelector(selectTick);
  const subtick = useSelector(selectSubtick);
  const dispatch = useGameDispatch();
  const fraction = useTickFraction();
  const [confirming, setConfirming] = useState<string | null>(null);

  const handleCancel = useCallback((contractId: string) => {
    dispatch({ type: "CancelContract", contractId: contractId as Contract["id"] });
    setConfirming(null);
  }, [dispatch]);

  if (contractViews.length === 0) {
    return <p className={styles.empty}>No active contracts yet — accept one from the market.</p>;
  }

  return (
    <div className={styles.list}>
      {contractViews.map((view) => {
        const contract = view.contract;
        const started = contract.startedAtTick ?? tick;
        const elapsedMonths = Math.max(0, tick - started);
        const progress = Math.min(1, elapsedMonths / Math.max(contract.termMonths, 1));
        const monthsLeft = Math.max(0, contract.termMonths - elapsedMonths);
        const { months: mLeft, days: dLeft } = monthsAndDaysBetween(
          tick,
          (subtick + fraction) / DAYS_PER_TICK,
          started + contract.termMonths,
          0,
        );
        const remainingLabel = formatRemaining(mLeft, dLeft);
        const isExpiringThisMonth = monthsLeft <= 0 && contract.lifecycleState === "serving";
        const isConfirming = confirming === contract.id;
        const canCancel = contract.lifecycleState === "serving" || contract.lifecycleState === "breached";

        return (
          <div key={contract.id} className={[styles.card, styles[`status-${contract.status}`]].join(" ")}>
            <div className={styles.cardTop}>
              <div className={styles.cardLeft}>
                <span className={[styles.statusPill, styles[`pill-${contract.status}`]].join(" ")}>
                  {STATUS_LABEL[contract.status]}
                </span>
                <div className={styles.name}>{contract.name}</div>
                <div className={styles.dcLabel}>→ {view.assignedDcName ?? "—"}</div>
                <div className={styles.affinityRow}>
                  <span className={[
                    styles.affinityBadge,
                    view.affinity.restricted ? styles.affinityBadgeRestricted : styles.affinityBadgeUnrestricted,
                  ].join(" ")}>{view.affinity.badgeLabel}</span>
                  <span className={styles.affinityDetail}>{view.affinity.restricted
                    ? `Allowed regions: ${view.affinity.allowedRegions.join(", ")}`
                    : "Deployable from any region."}</span>
                </div>
              </div>
              <div className={styles.financials}>
                <div className={styles.payment}>{fmt(contract.monthlyPayment)}<span className={styles.unit}>/mo</span></div>
                <div className={styles.marginLine}>{fmt(view.margin)}<span className={styles.unit}> margin</span></div>
              </div>
            </div>

            {view.capacityBufferLow && contract.lifecycleState === "serving" && (
              <div className={styles.warningBadge}>Capacity buffer low</div>
            )}

            <div className={[
              styles.slaHint,
              contract.lifecycleState === "breached" ? styles.slaHintNegative : styles.slaHintPositive,
            ].join(" ")}>{view.slaHint}</div>

            <div className={styles.affinityRow}>
              <span className={[
                styles.affinityBadge,
                view.slaProgress.status === "missed"
                  ? styles.affinityBadgeRestricted
                  : styles.affinityBadgeUnrestricted,
              ].join(" ")}>{view.slaProgress.slaTargetPercent}% SLA</span>
              <span className={styles.affinityDetail}>
                {SLA_STATUS_LABEL[view.slaProgress.status]} · {view.slaProgress.servedDays} served / {view.slaProgress.failedDays} failed day{view.slaProgress.failedDays === 1 ? "" : "s"}
                · failure budget {view.slaProgress.remainingFailureBudgetDays}/{view.slaProgress.maxFailedDays} day{view.slaProgress.maxFailedDays === 1 ? "" : "s"} left
              </span>
            </div>

            <div className={styles.progressRow}>
              <ProgressBar
                value={progress * 100}
                max={100}
                segments={contract.termMonths}
                color={contract.lifecycleState === "breached" ? "red" : "lime"}
                showLabel
                height={6}
                label={`Contract progress: ${Math.round(progress * 100)}%`}
                pulse={monthsLeft <= 2 && contract.lifecycleState === "serving"}
              />
              <span className={styles.progressMeta}>
                {elapsedMonths}/{contract.termMonths} mo · {remainingLabel}
                {isExpiringThisMonth && (
                  <span className={styles.expiryUrgent}> · Expires this month!</span>
                )}
              </span>
            </div>

            {canCancel && !isConfirming && (
              <button className={styles.cancelBtn} onClick={() => setConfirming(contract.id)}>
                CANCEL CONTRACT
              </button>
            )}
            {isConfirming && (
              <div className={styles.confirmRow}>
                <span className={styles.confirmMsg}>
                  Cancel incurs a penalty of {fmt(contract.penaltyPerMonth)} — confirm?
                </span>
                <button className={styles.confirmYes} onClick={() => handleCancel(contract.id)}>YES, CANCEL</button>
                <button className={styles.confirmNo} onClick={() => setConfirming(null)}>KEEP</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
