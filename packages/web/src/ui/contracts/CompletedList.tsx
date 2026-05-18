import type { ContractStatus } from "@datacenter-tycoon/game-logic";
import { useSelector } from "../../store/storeContext.js";
import { selectHistoricalContractSummary } from "../../store/selectors.js";
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
  const historySummary = useSelector(selectHistoricalContractSummary);

  if (historySummary.totalCount === 0) {
    return <p className={styles.empty}>No historical contracts yet.</p>;
  }

  return (
    <div className={styles.list}>
      {historySummary.views.map((view) => {
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
        <span>Completed: <strong className={styles.footerRevenue}>{historySummary.completedCount}</strong></span>
        <span className={styles.footerDivider}>|</span>
        <span>Cancelled: <strong className={styles.footerPenalty}>{historySummary.cancelledCount}</strong></span>
        <span className={styles.footerDivider}>|</span>
        <span>History: <strong>{historySummary.totalCount}</strong></span>
      </div>
    </div>
  );
}
