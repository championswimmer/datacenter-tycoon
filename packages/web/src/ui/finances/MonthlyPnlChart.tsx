import type { FinancialSnapshot } from "@datacenter-tycoon/game-logic";
import { formatGameDateShort, tickToGameDate } from "../../store/gameTime.js";
import styles from "./MonthlyPnlChart.module.css";

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatCompactMoney(value: number): string {
  return compactCurrencyFormatter.format(value);
}

export function MonthlyPnlChart({ snapshots, maxMonths = 12 }: { snapshots: FinancialSnapshot[]; maxMonths?: number }) {
  const monthlySnapshots = snapshots.filter((snapshot) => snapshot.tick > 0).slice(-maxMonths);

  if (monthlySnapshots.length === 0) {
    return <div className={styles.empty}>Monthly revenue and profit bars appear after the first month closes.</div>;
  }

  const width = Math.max(640, monthlySnapshots.length * 64 + 96);
  const height = 280;
  const padding = { top: 24, right: 20, bottom: 54, left: 52 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const baselineY = padding.top + chartHeight / 2;
  const maxMagnitude = Math.max(
    1,
    ...monthlySnapshots.map((snapshot) => Math.max(snapshot.revenue, snapshot.opex + snapshot.penalty, Math.abs(snapshot.netOperating))),
  );
  const scale = (chartHeight / 2 - 18) / maxMagnitude;
  const bandWidth = chartWidth / monthlySnapshots.length;
  const revenueWidth = Math.max(14, bandWidth * 0.42);
  const netWidth = Math.max(8, revenueWidth * 0.4);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>MONTHLY P&amp;L</h3>
          <p className={styles.subtitle}>Revenue vs OpEx/penalty with net operating profit or loss.</p>
        </div>
        <div className={styles.legend}>
          <LegendSwatch className={styles.swatchRevenue!} label="Revenue" />
          <LegendSwatch className={styles.swatchExpense!} label="OpEx + penalty" />
          <LegendSwatch className={styles.swatchProfit!} label="Net profit / loss" />
        </div>
      </div>

      <div className={styles.viewport}>
        <svg viewBox={`0 0 ${width} ${height}`} className={styles.chart} role="img" aria-label="Monthly profit and loss chart">
          <line x1={padding.left} y1={baselineY} x2={padding.left + chartWidth} y2={baselineY} className={styles.axis} />
          <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + chartHeight} className={styles.axis} />
          <text x={padding.left - 8} y={padding.top + 8} className={styles.axisLabel} textAnchor="end">
            {formatCompactMoney(maxMagnitude)}
          </text>
          <text x={padding.left - 8} y={padding.top + chartHeight - 4} className={styles.axisLabel} textAnchor="end">
            -{formatCompactMoney(maxMagnitude)}
          </text>

          {monthlySnapshots.map((snapshot, index) => {
            const xCenter = padding.left + bandWidth * index + bandWidth / 2;
            const expense = snapshot.opex + snapshot.penalty;
            const revenueHeight = snapshot.revenue * scale;
            const expenseHeight = expense * scale;
            const netHeight = Math.abs(snapshot.netOperating) * scale;
            const label = formatGameDateShort(tickToGameDate(snapshot.tick));

            return (
              <g key={snapshot.tick}>
                <rect
                  x={xCenter - revenueWidth / 2}
                  y={baselineY - revenueHeight}
                  width={revenueWidth}
                  height={Math.max(0, revenueHeight)}
                  className={styles.revenueBar}
                  rx="4"
                />
                <rect
                  x={xCenter - revenueWidth / 2}
                  y={baselineY}
                  width={revenueWidth}
                  height={Math.max(0, expenseHeight)}
                  className={styles.expenseBar}
                  rx="4"
                />
                <rect
                  x={xCenter - netWidth / 2}
                  y={snapshot.netOperating >= 0 ? baselineY - netHeight : baselineY}
                  width={netWidth}
                  height={Math.max(0, netHeight)}
                  className={snapshot.netOperating >= 0 ? styles.netProfitBar : styles.netLossBar}
                  rx="4"
                />
                <text x={xCenter} y={height - 16} className={styles.axisLabel} textAnchor="middle">
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className={styles.legendItem}>
      <span className={[styles.swatch, className].join(" ")} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
