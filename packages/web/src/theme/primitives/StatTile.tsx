import type { ReactNode } from "react";
import styles from "./StatTile.module.css";

export interface StatTileProps {
  /** The label shown above the value */
  label: string;
  /** Main value — string or number */
  value: ReactNode;
  /** Optional sub-value shown below the main value */
  sub?: ReactNode;
  /** Neon color variant for the value */
  color?: "cyan" | "amber" | "lime" | "magenta" | "red" | "default";
  /** Whether the tile takes up extra horizontal space */
  wide?: boolean;
}

export function StatTile({ label, value, sub, color = "default", wide }: StatTileProps) {
  return (
    <div className={[styles.tile, wide ? styles.wide : ""].filter(Boolean).join(" ")}>
      <span className={styles.label}>{label}</span>
      <span className={[styles.value, styles[`color-${color}`]].join(" ")}>
        {value}
      </span>
      {sub !== undefined && <span className={styles.sub}>{sub}</span>}
    </div>
  );
}
