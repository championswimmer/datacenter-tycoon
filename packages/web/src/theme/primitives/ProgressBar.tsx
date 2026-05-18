import { useMemo } from "react";
import styles from "./ProgressBar.module.css";

export interface ProgressBarProps {
  /** Current value (0 – max) */
  value: number;
  /** Maximum value. Defaults to 100 */
  max?: number;
  /** Number of visual segments. Defaults to 20 */
  segments?: number;
  /** Color scheme, auto-transitions from low→high if "auto" */
  color?: "cyan" | "amber" | "lime" | "red" | "auto";
  /** Show percentage text label */
  showLabel?: boolean;
  /** Height in px. Default 8 */
  height?: number;
  /** Accessible label */
  label?: string;
  /** Pulse animation for urgency */
  pulse?: boolean;
}

function resolveColor(color: ProgressBarProps["color"], pct: number): string {
  if (color !== "auto") return color ?? "cyan";
  if (pct >= 0.9) return "red";
  if (pct >= 0.7) return "amber";
  return "cyan";
}

export function ProgressBar({
  value,
  max = 100,
  segments = 20,
  color = "auto",
  showLabel = false,
  height = 8,
  label,
  pulse = false,
}: ProgressBarProps) {
  const pct = Math.min(Math.max(value / max, 0), 1);
  const resolvedColor = resolveColor(color, pct);
  const trackStyle = useMemo(() => ({
    height,
    "--fill-width": `${pct * 100}%`,
    "--segment-count": String(Math.max(1, segments)),
  } as React.CSSProperties), [height, pct, segments]);

  return (
    <span
      className={styles.wrapper}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <span
        className={[
          styles.track,
          styles[`filled-${resolvedColor}`],
          pulse ? styles.pulse : "",
        ].join(" ")}
        style={trackStyle}
      />
      {showLabel && (
        <span className={styles.label}>{Math.round(pct * 100)}%</span>
      )}
    </span>
  );
}
