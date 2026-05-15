import type { Datacenter, DatacenterInfrastructureView, DatacenterResourceUsage } from "@datacenter-tycoon/game-logic";
import { ProgressBar } from "../../theme/primitives/index.js";
import styles from "./ResourceBars.module.css";

interface ResourceBarsProps {
  datacenter: Datacenter;
  usage:      DatacenterResourceUsage;
  infrastructure?: DatacenterInfrastructureView;
  /** "compact" = slim bars only, "full" = bars with labels and numbers */
  mode?: "compact" | "full";
}

function pct(used: number, cap: number) {
  return cap > 0 ? used / cap : 0;
}

function fmt(n: number, unit: string, decimals = 1) {
  return `${n.toFixed(decimals)} ${unit}`;
}

function fmtBtu(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export function ResourceBars({ datacenter, usage, infrastructure, mode = "full" }: ResourceBarsProps) {
  const spec = datacenter.spec;
  const effective = infrastructure?.effective;

  const bars = [
    {
      label:    "POWER",
      used:     usage.powerKw,
      cap:      effective?.rackPowerCapacityKw ?? spec.powerCapacityKw,
      unitUsed: fmt(usage.powerKw, "kW"),
      unitCap:  fmt(effective?.rackPowerCapacityKw ?? spec.powerCapacityKw, "kW"),
    },
    {
      label:    "COOLING",
      used:     usage.heatOutputBtuPerHr,
      cap:      effective?.coolingCapacityBtuPerHr ?? spec.coolingCapacityBtuPerHr,
      unitUsed: `${fmtBtu(usage.heatOutputBtuPerHr)} BTU/hr`,
      unitCap:  `${fmtBtu(effective?.coolingCapacityBtuPerHr ?? spec.coolingCapacityBtuPerHr)} BTU/hr`,
    },
    {
      label:    "BANDWIDTH",
      used:     usage.bandwidthGbps,
      cap:      effective?.bandwidthGbps ?? spec.bandwidthGbps,
      unitUsed: fmt(usage.bandwidthGbps, "Gbps"),
      unitCap:  fmt(effective?.bandwidthGbps ?? spec.bandwidthGbps, "Gbps"),
    },
    {
      label:    "SLOTS",
      used:     usage.slotsUsed,
      cap:      spec.rows * spec.positionsPerRow,
      unitUsed: String(usage.slotsUsed),
      unitCap:  String(spec.rows * spec.positionsPerRow),
      decimals: 0,
    },
  ];

  if (mode === "compact") {
    return (
      <div className={styles.compact}>
        {bars.map(b => (
          <div key={b.label} className={styles.compactItem} title={`${b.label}: ${b.unitUsed} / ${b.unitCap}`}>
            <span className={styles.compactLabel}>{b.label}</span>
            <ProgressBar value={pct(b.used, b.cap) * 100} max={100} segments={10} color="auto" height={4} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.full}>
      {bars.map(b => {
        const fraction = pct(b.used, b.cap);
        const pctVal = Math.round(fraction * 100);
        return (
          <div key={b.label} className={styles.row}>
            <span className={styles.rowLabel}>{b.label}</span>
            <div className={styles.barWrap}>
              <ProgressBar value={fraction * 100} max={100} segments={20} color="auto" height={8} />
            </div>
            <span className={styles.rowNums}>
              {b.unitUsed}
              <span className={styles.numSep}>/</span>
              {b.unitCap}
            </span>
            <span className={[
              styles.rowPct,
              pctVal >= 90 ? styles.pctRed : pctVal >= 70 ? styles.pctAmber : styles.pctGreen,
            ].join(" ")}>
              {pctVal}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
