import { useCallback, useMemo, useState } from "react";
import { tickOpex } from "@datacenter-tycoon/game-logic";
import type { Contract, ContractStatus } from "@datacenter-tycoon/game-logic";
import { useSelector, useGameDispatch } from "../../store/storeContext.js";
import {
  selectActiveContracts,
  selectAllDatacenters,
  selectDatacenterCapacitySummary,
  selectReliabilitySummary,
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

export function ActiveList() {
  const contracts = useSelector(selectActiveContracts);
  const datacenters = useSelector(selectAllDatacenters);
  const regions = useSelector((state) => state.map.regions);
  const tick = useSelector(selectTick);
  const reliability = useSelector(selectReliabilitySummary);
  const capacityByDcId = useSelector((state) => new Map(
    state.datacenters.map((dc) => [dc.id, selectDatacenterCapacitySummary(state, dc.id)]),
  ));
  const dispatch = useGameDispatch();
  const fraction = useTickFraction();
  const [confirming, setConfirming] = useState<string | null>(null);

  const handleCancel = useCallback((contractId: string) => {
    dispatch({ type: "CancelContract", contractId: contractId as Contract["id"] });
    setConfirming(null);
  }, [dispatch]);

  const dcName = (id: string | undefined) =>
    datacenters.find((datacenter) => datacenter.id === id)?.name ?? "—";

  const sorted = useMemo(() => [...contracts].sort((a, b) => {
    const order: Record<ContractStatus, number> = {
      breached: 0,
      active: 1,
      offered: 2,
      expired: 3,
      cancelled: 4,
    };
    return order[a.status] - order[b.status];
  }), [contracts]);

  if (sorted.length === 0) {
    return <p className={styles.empty}>No active contracts yet — accept one from the market.</p>;
  }

  return (
    <div className={styles.list}>
      {sorted.map((contract) => {
        const started = contract.startedAtTick ?? tick;
        const elapsedMonths = Math.max(0, tick - started);
        const progress = Math.min(1, elapsedMonths / Math.max(contract.termMonths, 1));
        const monthsLeft = Math.max(0, contract.termMonths - elapsedMonths);
        const { months: mLeft, days: dLeft } = monthsAndDaysBetween(
          tick,
          fraction,
          started + contract.termMonths,
          0,
        );
        const remainingLabel = formatRemaining(mLeft, dLeft);
        const isExpiringThisMonth = monthsLeft <= 0 && contract.lifecycleState === "serving";
        const isConfirming = confirming === contract.id;
        const canCancel = contract.lifecycleState === "serving" || contract.lifecycleState === "breached";

        const datacenter = datacenters.find((entry) => entry.id === contract.assignedDcId);
        const region = datacenter ? regions.find((entry) => entry.id === datacenter.regionId) : undefined;
        const contractsOnDatacenter = contracts.filter((entry) => entry.assignedDcId === datacenter?.id);
        const attributedOpex = datacenter && region
          ? tickOpex(datacenter, region).total / Math.max(contractsOnDatacenter.length, 1)
          : 0;
        const margin = contract.monthlyPayment - attributedOpex;

        const free = datacenter ? capacityByDcId.get(datacenter.id)?.available : undefined;
        const bufferLow = free !== undefined && (
          free.vCpu < contract.requirements.vCpu * 0.1 ||
          free.ramGb < contract.requirements.ramGb * 0.1 ||
          (contract.requirements.storageTb > 0 && free.storageTb < contract.requirements.storageTb * 0.1) ||
          (contract.requirements.gpuFlops > 0 && free.gpuFlops < contract.requirements.gpuFlops * 0.1)
        );
        const latestOutcome = [...reliability.recentOutcomes].reverse().find((outcome) => outcome.contractId === contract.id);
        const slaHint = contract.lifecycleState === "breached"
          ? "SLA hit: this breach already hurt reliability. Recover service now or cancellation will damage it again."
          : latestOutcome?.kind === "fulfilled"
            ? "SLA credit: this contract improved reliability last month — keep it stable to preserve market access."
            : (reliability.band === "silver" || reliability.band === "bronze")
              ? "SLA recovery: clean delivery here helps restore reputation and future offer volume."
              : "SLA impact: fulfilled months improve future contract access and longer-term opportunities.";

        return (
          <div key={contract.id} className={[styles.card, styles[`status-${contract.status}`]].join(" ")}>
            <div className={styles.cardTop}>
              <div className={styles.cardLeft}>
                <span className={[styles.statusPill, styles[`pill-${contract.status}`]].join(" ")}>
                  {STATUS_LABEL[contract.status]}
                </span>
                <div className={styles.name}>{contract.name}</div>
                <div className={styles.dcLabel}>→ {dcName(contract.assignedDcId)}</div>
              </div>
              <div className={styles.financials}>
                <div className={styles.payment}>{fmt(contract.monthlyPayment)}<span className={styles.unit}>/mo</span></div>
                <div className={styles.marginLine}>{fmt(margin)}<span className={styles.unit}> margin</span></div>
              </div>
            </div>

            {bufferLow && contract.lifecycleState === "serving" && (
              <div className={styles.warningBadge}>Capacity buffer low</div>
            )}

            <div className={[
              styles.slaHint,
              contract.lifecycleState === "breached" ? styles.slaHintNegative : styles.slaHintPositive,
            ].join(" ")}>{slaHint}</div>

            <div className={styles.progressRow}>
              <ProgressBar
                value={progress * 100}
                max={100}
                segments={contract.termMonths}
                color={contract.lifecycleState === "breached" ? "red" : contract.status === "expired" ? "cyan" : "lime"}
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
