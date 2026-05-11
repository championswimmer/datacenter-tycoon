import type { Contract, ContractStatus } from "@datacenter-tycoon/game-logic";
import { useSelector } from "../../store/storeContext.js";
import { selectAllDatacenters, selectHistoricalContracts } from "../../store/selectors.js";
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
  const history = useSelector(selectHistoricalContracts);
  const datacenters = useSelector(selectAllDatacenters);

  const dcName = (id: string | undefined) =>
    datacenters.find((datacenter) => datacenter.id === id)?.name ?? "—";

  const completedCount = history.filter((contract) => contract.lifecycleState === "completed").length;
  const cancelledCount = history.filter((contract) => contract.lifecycleState === "cancelled").length;

  if (history.length === 0) {
    return <p className={styles.empty}>No historical contracts yet.</p>;
  }

  return (
    <div className={styles.list}>
      {history.map((contract: Contract) => (
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
              <div className={contract.lifecycleState === "completed" ? styles.payment : styles.penaltyTotal}>
                {contract.lifecycleState === "completed"
                  ? `${fmt(contract.monthlyPayment)}/mo revenue`
                  : `−${fmt(contract.penaltyPerMonth)}/mo penalty`}
              </div>
              <div className={styles.termMeta}>{contract.termMonths} mo term</div>
            </div>
          </div>
        </div>
      ))}

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
