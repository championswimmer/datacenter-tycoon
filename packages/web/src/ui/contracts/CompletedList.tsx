import type { ContractStatus } from "@datacenter-tycoon/game-logic";
import { useSelector } from "../../store/storeContext.js";
import { selectHistoricalContractViews } from "../../store/selectors.js";
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

export function CompletedList() {
  const history = useSelector(selectHistoricalContractViews);

  const completedCount = history.filter((view) => view.contract.lifecycleState === "completed").length;
  const cancelledCount = history.filter((view) => view.contract.lifecycleState === "cancelled").length;

  if (history.length === 0) {
    return <p className={styles.empty}>No historical contracts yet.</p>;
  }

  return (
    <div className={styles.list}>
      {history.map((view) => {
        const contract = view.contract;
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
                <div className={contract.lifecycleState === "completed" ? styles.payment : styles.penaltyTotal}>
                  {contract.lifecycleState === "completed"
                    ? `${fmt(contract.monthlyPayment)}/mo revenue`
                    : `−${fmt(contract.penaltyPerMonth)}/mo penalty`}
                </div>
                <div className={styles.termMeta}>{contract.termMonths} mo term</div>
              </div>
            </div>
          </div>
        );
      })}

      <div className={styles.aggregateFooter}>
        <span>Completed: <strong className={styles.footerRevenue}>{completedCount}</strong></span>
        <span className={styles.footerDivider}>|</span>
        <span>Cancelled: <strong className={styles.footerPenalty}>{cancelledCount}</strong></span>
        <span className={styles.footerDivider}>|</span>
        <span>History: <strong>{history.length}</strong></span>
      </div>
    </div>
  );
}
