import type { OpexBreakdown } from "@datacenter-tycoon/game-logic";
import styles from "./OpexCard.module.css";

interface OpexCardProps {
  total:     number;
  breakdown: OpexBreakdown;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

const SEGMENTS: Array<{
  key:   keyof OpexBreakdown;
  label: string;
  color: string;
}> = [
  { key: "staff",       label: "STAFF",       color: "#5ef0ff" },
  { key: "power",       label: "POWER",       color: "#ffb13c" },
  { key: "cooling",     label: "COOLING",     color: "#60a5fa" },
  { key: "bandwidth",   label: "BANDWIDTH",   color: "#c084fc" },
  { key: "maintenance", label: "MAINT",       color: "#9bff5a" },
];

export function OpexCard({ total, breakdown }: OpexCardProps) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.title}>OPEX</span>
        <span className={styles.total}>{fmt(total)}<span className={styles.perMo}>/mo</span></span>
      </div>

      {/* Stacked bar */}
      <div className={styles.stackBar}>
        {SEGMENTS.filter(s => breakdown[s.key] > 0).map(s => (
          <div
            key={s.key}
            className={styles.segment}
            style={{
              width: `${(breakdown[s.key] / total) * 100}%`,
              background: s.color,
            }}
            title={`${s.label}: ${fmt(breakdown[s.key])}`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        {SEGMENTS.map(s => (
          <div key={s.key} className={styles.legendRow}>
            <span className={styles.legendDot} style={{ background: s.color }} />
            <span className={styles.legendLabel}>{s.label}</span>
            <span className={styles.legendAmt}>{fmt(breakdown[s.key])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
