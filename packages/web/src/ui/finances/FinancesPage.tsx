import { useMemo } from "react";
import { useSelector } from "../../store/storeContext.js";
import {
  selectFinanceOverview,
  selectFinancialHistory,
} from "../../store/selectors.js";
import { formatGameDateShort, tickToGameDate } from "../../store/gameTime.js";
import { CashHistoryChart } from "./CashHistoryChart.js";
import styles from "./FinancesPage.module.css";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatMoney(value: number): string {
  return currencyFormatter.format(value);
}

function formatCompactMoney(value: number): string {
  return compactCurrencyFormatter.format(value);
}

export function FinancesPage() {
  const overview = useSelector(selectFinanceOverview);
  const financialHistory = useSelector(selectFinancialHistory);

  const monthlyHistory = useMemo(
    () => financialHistory.filter((snapshot) => snapshot.tick > 0),
    [financialHistory],
  );
  const tableRows = useMemo(
    () => [...monthlyHistory].reverse(),
    [monthlyHistory],
  );

  return (
    <section className={styles.page} aria-label="Finances">
      <div className={styles.header}>
        <h2 className={styles.title}>FINANCES</h2>
        <p className={styles.subtitle}>
          Review monthly cashflow, revenue, OpEx, penalties, and cumulative revenue for your run.
        </p>
      </div>

      <div className={styles.summaryGrid}>
        <SummaryCard label="Current cash" value={formatCompactMoney(overview.currentCash)} tone="cash" />
        <SummaryCard label="Cumulative revenue" value={formatCompactMoney(overview.cumulativeRevenue)} tone="revenue" />
        <SummaryCard label="Last month revenue" value={formatCompactMoney(overview.lastMonthRevenue)} tone="revenue" />
        <SummaryCard label="Last month OpEx + penalty" value={formatCompactMoney(overview.lastMonthOpex + overview.lastMonthPenalty)} tone="expense" />
        <SummaryCard label="Last month capex" value={formatCompactMoney(overview.lastMonthCapex)} tone="neutral" />
        <SummaryCard
          label="Last month net operating"
          value={formatCompactMoney(overview.lastMonthNetOperating)}
          tone={overview.lastMonthNetOperating >= 0 ? "profit" : "loss"}
        />
      </div>

      <div className={styles.chartGrid}>
        <CashHistoryChart snapshots={financialHistory} />
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>MONTHLY HISTORY</h3>
          <span className={styles.sectionMeta}>{monthlyHistory.length} recorded months</span>
        </div>

        {tableRows.length === 0 ? (
          <div className={styles.emptyState}>Finance history will populate after the first month closes.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Cash</th>
                  <th>Revenue</th>
                  <th>OpEx</th>
                  <th>Penalty</th>
                  <th>CapEx</th>
                  <th>Net op</th>
                  <th>Cumulative rev</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((snapshot) => (
                  <tr key={snapshot.tick}>
                    <td>{formatGameDateShort(tickToGameDate(snapshot.tick))}</td>
                    <td>{formatMoney(snapshot.cash)}</td>
                    <td className={styles.valueRevenue}>{formatMoney(snapshot.revenue)}</td>
                    <td className={styles.valueExpense}>{formatMoney(snapshot.opex)}</td>
                    <td className={styles.valueExpense}>{formatMoney(snapshot.penalty)}</td>
                    <td className={styles.valueExpense}>{formatMoney(snapshot.capex)}</td>
                    <td className={snapshot.netOperating >= 0 ? styles.valueProfit : styles.valueLoss}>
                      {formatMoney(snapshot.netOperating)}
                    </td>
                    <td>{formatMoney(snapshot.cumulativeRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "cash" | "revenue" | "expense" | "profit" | "loss" | "neutral";
}) {
  return (
    <div className={[styles.summaryCard, styles[`tone${tone[0]!.toUpperCase()}${tone.slice(1)}`]].join(" ")}>
      <span className={styles.summaryLabel}>{label}</span>
      <strong className={styles.summaryValue}>{value}</strong>
    </div>
  );
}
