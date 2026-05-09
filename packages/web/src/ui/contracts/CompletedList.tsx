import type { Contract, ContractStatus } from "@datacenter-tycoon/game-logic";
import { useSelector } from "../../store/storeContext.js";
import { selectAllDatacenters } from "../../store/selectors.js";
import styles from "./ActiveList.module.css";

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

const STATUS_LABEL: Record<ContractStatus, string> = {
  active:    "ACTIVE",
  breached:  "BREACHED",
  expired:   "EXPIRED",
  cancelled: "CANCELLED",
  offered:   "OFFERED",
};

export function CompletedList() {
  const state = (useSelector as (fn: (s: import("@datacenter-tycoon/game-logic").GameState) => unknown) => unknown)(
    (s: import("@datacenter-tycoon/game-logic").GameState) => s.activeContracts,
  ) as Contract[];
  const datacenters = useSelector(selectAllDatacenters);

  const completed = state.filter(c => c.status === "expired" || c.status === "cancelled");

  const dcName = (id: string | undefined) =>
    datacenters.find(d => d.id === id)?.name ?? "—";

  const totalRevenue = completed
    .filter(c => c.status === "expired")
    .reduce((sum, c) => {
      const months = c.termMonths;
      return sum + c.monthlyPayment * months;
    }, 0);

  const totalPenalties = completed
    .filter(c => c.status === "cancelled")
    .reduce((sum, c) => sum + c.penaltyPerMonth, 0);

  if (completed.length === 0) {
    return <p className={styles.empty}>No expired or cancelled contracts yet.</p>;
  }

  return (
    <div className={styles.list}>
      {completed.map(c => (
        <div key={c.id} className={[styles.card, styles[`status-${c.status}`]].join(" ")}>
          <div className={styles.cardTop}>
            <div className={styles.cardLeft}>
              <span className={[styles.statusPill, styles[`pill-${c.status}`]].join(" ")}>
                {STATUS_LABEL[c.status]}
              </span>
              <div className={styles.name}>{c.name}</div>
              <div className={styles.dcLabel}>→ {dcName(c.assignedDcId)}</div>
            </div>
            <div className={styles.financials}>
              {c.status === "expired" ? (
                <div className={styles.payment}>
                  {fmt(c.monthlyPayment * c.termMonths)}<span className={styles.unit}> earned</span>
                </div>
              ) : (
                <div className={styles.penaltyTotal}>
                  −{fmt(c.penaltyPerMonth)}<span className={styles.unit}> penalty</span>
                </div>
              )}
              <div className={styles.termMeta}>{c.termMonths} mo term</div>
            </div>
          </div>
        </div>
      ))}

      <div className={styles.aggregateFooter}>
        <span>Revenue: <strong className={styles.footerRevenue}>{fmt(totalRevenue)}</strong></span>
        <span className={styles.footerDivider}>|</span>
        <span>Penalties: <strong className={styles.footerPenalty}>−{fmt(totalPenalties)}</strong></span>
        <span className={styles.footerDivider}>|</span>
        <span>Net: <strong className={totalRevenue - totalPenalties >= 0 ? styles.footerRevenue : styles.footerPenalty}>
          {fmt(totalRevenue - totalPenalties)}
        </strong></span>
      </div>
    </div>
  );
}
