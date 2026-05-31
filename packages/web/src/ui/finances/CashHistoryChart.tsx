import type { FinancialSnapshot } from "@datacenter-tycoon/game-logic";
import { formatGameDateShort, tickToGameDate } from "../../store/gameTime.js";
import styles from "./CashHistoryChart.module.css";

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatCompactMoney(value: number): string {
  return compactCurrencyFormatter.format(value);
}

export function CashHistoryChart({ snapshots }: { snapshots: FinancialSnapshot[] }) {
  if (snapshots.length === 0) {
    return <div className={styles.empty}>Cash history will appear once the run starts.</div>;
  }

  const width = 720;
  const height = 240;
  const padding = { top: 20, right: 20, bottom: 42, left: 52 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const cashValues = snapshots.map((snapshot) => snapshot.cash);
  const minCash = Math.min(...cashValues);
  const maxCash = Math.max(...cashValues);
  const range = maxCash - minCash || Math.max(1, Math.abs(maxCash) * 0.1 || 1);
  const yMin = minCash - range * 0.1;
  const yMax = maxCash + range * 0.1;
  const yRange = yMax - yMin || 1;

  const points = snapshots.map((snapshot, index) => {
    const x = padding.left + (snapshots.length === 1 ? chartWidth / 2 : (index / (snapshots.length - 1)) * chartWidth);
    const y = padding.top + ((yMax - snapshot.cash) / yRange) * chartHeight;
    return { snapshot, x, y };
  });

  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = `${linePath} L ${points.at(-1)!.x} ${padding.top + chartHeight} L ${points[0]!.x} ${padding.top + chartHeight} Z`;
  const firstPoint = points[0]!;
  const midPoint = points[Math.floor(points.length / 2)]!;
  const lastPoint = points.at(-1)!;
  const currentCash = snapshots.at(-1)!.cash;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>CASH HISTORY</h3>
          <p className={styles.subtitle}>Closing cash at each monthly tick.</p>
        </div>
        <div className={styles.meta}>
          <span>Current {formatCompactMoney(currentCash)}</span>
          <span>Range {formatCompactMoney(minCash)} → {formatCompactMoney(maxCash)}</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className={styles.chart} role="img" aria-label="Cash history chart">
        <line x1={padding.left} y1={padding.top + chartHeight} x2={padding.left + chartWidth} y2={padding.top + chartHeight} className={styles.axis} />
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + chartHeight} className={styles.axis} />
        <line
          x1={padding.left}
          y1={padding.top + ((yMax - 0) / yRange) * chartHeight}
          x2={padding.left + chartWidth}
          y2={padding.top + ((yMax - 0) / yRange) * chartHeight}
          className={styles.zeroLine}
        />
        <path d={areaPath} className={styles.area} />
        <path d={linePath} className={styles.line} />
        {points.map((point) => (
          <circle key={point.snapshot.tick} cx={point.x} cy={point.y} r="3.5" className={styles.point} />
        ))}

        <text x={padding.left - 8} y={padding.top + 8} className={styles.axisLabel} textAnchor="end">
          {formatCompactMoney(yMax)}
        </text>
        <text x={padding.left - 8} y={padding.top + chartHeight + 4} className={styles.axisLabel} textAnchor="end">
          {formatCompactMoney(yMin)}
        </text>

        {[firstPoint, midPoint, lastPoint].map((point, index) => (
          <text key={`${point.snapshot.tick}-${index}`} x={point.x} y={height - 12} className={styles.axisLabel} textAnchor="middle">
            {formatGameDateShort(tickToGameDate(point.snapshot.tick))}
          </text>
        ))}
      </svg>
    </div>
  );
}
