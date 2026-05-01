import { useState, useCallback } from "react";
import type { Contract, ContractStatus } from "@datacenter-tycoon/game-logic";
import { tickOpex } from "@datacenter-tycoon/game-logic";
import { useSelector, useGameDispatch } from "../../store/storeContext.js";
import {
  selectActiveContracts, selectAllDatacenters, selectTick,
} from "../../store/selectors.js";
import { ProgressBar } from "../../theme/primitives/index.js";
import { dcFreeCapacity, canFulfill } from "./contractUtils.js";
import { useTickFraction } from "../../store/tickFractionStore.js";
import { monthsAndDaysBetween, formatRemaining } from "../../store/gameTime.js";
import styles from "./ActiveList.module.css";

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

const STATUS_LABEL: Record<ContractStatus, string> = {
  active:    "ACTIVE",
  breached:  "BREACHED",
  completed: "COMPLETED",
  cancelled: "CANCELLED",
  offered:   "OFFERED",
};

export function ActiveList() {
  const contracts   = useSelector(selectActiveContracts);
  const datacenters = useSelector(selectAllDatacenters);
  const tick        = useSelector(selectTick);
  const dispatch    = useGameDispatch();
  const fraction    = useTickFraction();
  const [confirming, setConfirming] = useState<string | null>(null);

  const handleCancel = useCallback((contractId: string) => {
    dispatch({ type: "CancelContract", contractId: contractId as Contract["id"] });
    setConfirming(null);
  }, [dispatch]);

  const dcName = (id: string | undefined) =>
    datacenters.find(d => d.id === id)?.name ?? "—";

  const sorted = [...contracts].sort((a, b) => {
    const order: Record<ContractStatus, number> = {
      breached: 0, active: 1, offered: 2, completed: 3, cancelled: 4,
    };
    return order[a.status] - order[b.status];
  });

  if (sorted.length === 0) {
    return <p className={styles.empty}>No active contracts yet — accept one from the market.</p>;
  }

  return (
    <div className={styles.list}>
      {sorted.map(c => {
        const started = c.startedAtTick ?? tick;
        const elapsedMonths = Math.max(0, tick - started);
        const progress = Math.min(1, elapsedMonths / Math.max(c.termMonths, 1));
        const monthsLeft = Math.max(0, c.termMonths - elapsedMonths);
        // Day-level precision for the remaining label using sub-tick fraction
        const { months: mLeft, days: dLeft } = monthsAndDaysBetween(
          tick, fraction,
          started + c.termMonths, 0,
        );
        const remainingLabel = formatRemaining(mLeft, dLeft);
        const isExpiringThisMonth = monthsLeft <= 0 && c.status === "active";
        const isConfirming = confirming === c.id;
        const canCancel = c.status === "active" || c.status === "breached";

        const dc = datacenters.find(d => d.id === c.assignedDcId);
        const contractsOnDc = contracts.filter(
          x => x.assignedDcId === dc?.id && x.status === "active",
        );
        const attributedOpex = dc
          ? tickOpex(dc).total / Math.max(contractsOnDc.length, 1)
          : 0;
        const margin = c.monthlyPayment - attributedOpex;

        const free = dc ? dcFreeCapacity(dc, contracts) : null;
        const bufferLow = free !== null && canFulfill(free, c.requirements) &&
          (free.vCpu < c.requirements.vCpu * 0.1 ||
           free.ramGb < c.requirements.ramGb * 0.1 ||
           (c.requirements.storageTb > 0 && free.storageTb < c.requirements.storageTb * 0.1) ||
           (c.requirements.gpuFlops > 0 && free.gpuFlops < c.requirements.gpuFlops * 0.1));

        return (
          <div key={c.id} className={[styles.card, styles[`status-${c.status}`]].join(" ")}>
            <div className={styles.cardTop}>
              <div className={styles.cardLeft}>
                <span
                  className={[styles.statusPill, styles[`pill-${c.status}`]].join(" ")}
                >
                  {STATUS_LABEL[c.status]}
                </span>
                <div className={styles.name}>{c.name}</div>
                <div className={styles.dcLabel}>→ {dcName(c.assignedDcId)}</div>
              </div>
              <div className={styles.financials}>
                <div className={styles.payment}>{fmt(c.monthlyPayment)}<span className={styles.unit}>/mo</span></div>
                <div className={styles.marginLine}>
                  {fmt(margin)}<span className={styles.unit}> margin</span>
                </div>
              </div>
            </div>

            {bufferLow && c.status === "active" && (
              <div className={styles.warningBadge}>Capacity buffer low</div>
            )}

            <div className={styles.progressRow}>
              <ProgressBar
                value={progress * 100}
                max={100}
                segments={c.termMonths}
                color={c.status === "breached" ? "red" : c.status === "completed" ? "cyan" : "lime"}
                showLabel
                height={6}
                label={`Contract progress: ${Math.round(progress * 100)}%`}
                pulse={monthsLeft <= 2 && c.status === "active"}
              />
              <span className={styles.progressMeta}>
                {elapsedMonths}/{c.termMonths} mo · {remainingLabel}
                {isExpiringThisMonth && (
                  <span className={styles.expiryUrgent}> · Expires this month!</span>
                )}
              </span>
            </div>

            {canCancel && !isConfirming && (
              <button className={styles.cancelBtn} onClick={() => setConfirming(c.id)}>
                CANCEL CONTRACT
              </button>
            )}
            {isConfirming && (
              <div className={styles.confirmRow}>
                <span className={styles.confirmMsg}>
                  Cancel incurs a penalty of {fmt(c.penaltyPerMonth)} — confirm?
                </span>
                <button className={styles.confirmYes} onClick={() => handleCancel(c.id)}>YES, CANCEL</button>
                <button className={styles.confirmNo}  onClick={() => setConfirming(null)}>KEEP</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
