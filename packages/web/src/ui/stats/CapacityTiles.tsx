import type { Capacity } from "@datacenter-tycoon/game-logic";
import styles from "./CapacityTiles.module.css";

interface CapacityTilesProps {
  total: Capacity;
  free:  Capacity;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

export function CapacityTiles({ total, free }: CapacityTilesProps) {
  const used = {
    vCpu:      total.vCpu      - free.vCpu,
    ramGb:     total.ramGb     - free.ramGb,
    storageTb: total.storageTb - free.storageTb,
    gpuFlops:  total.gpuFlops  - free.gpuFlops,
  };

  const tiles = [
    { label: "vCPU",    total: total.vCpu,      free: free.vCpu,      used: used.vCpu,      unit: "cores", color: "cyan"   },
    { label: "RAM",     total: total.ramGb,      free: free.ramGb,     used: used.ramGb,     unit: "GB",    color: "blue"   },
    { label: "STORAGE", total: total.storageTb,  free: free.storageTb, used: used.storageTb, unit: "TB",    color: "purple" },
    { label: "GPU",     total: total.gpuFlops,   free: free.gpuFlops,  used: used.gpuFlops,  unit: "TFLOPS", color: "amber" },
  ];

  return (
    <div className={styles.tiles}>
      {tiles.map(t => {
        const usedPct = t.total > 0 ? (t.used / t.total) * 100 : 0;
        return (
          <div key={t.label} className={[styles.tile, styles[`color-${t.color}`]].join(" ")}>
            <div className={styles.tileLabel}>{t.label}</div>
            <div className={styles.tileTotal}>{fmtNum(t.total)}<span className={styles.unit}> {t.unit}</span></div>
            <div className={styles.tileBar}>
              <div
                className={styles.tileFill}
                style={{ width: `${Math.min(usedPct, 100)}%` }}
                title={`${fmtNum(t.used)} used / ${fmtNum(t.total)} total`}
              />
            </div>
            <div className={styles.tileSubRow}>
              <span className={styles.tileFree}>{fmtNum(t.free)} free</span>
              <span className={styles.tileUsed}>{fmtNum(t.used)} used</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
