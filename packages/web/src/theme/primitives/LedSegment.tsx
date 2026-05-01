import styles from "./LedSegment.module.css";

export type LedColor = "cyan" | "amber" | "lime" | "red" | "magenta" | "off";

export interface LedSegmentProps {
  /** Color (and glow) of the LED */
  color?: LedColor;
  /** Whether the LED blinks */
  blink?: boolean;
  /** Optional label next to the LED */
  label?: string;
  /** Size in pixels — diameter of the circle. Default 8 */
  size?: number;
}

export function LedSegment({ color = "off", blink = false, label, size = 8 }: LedSegmentProps) {
  return (
    <span className={styles.wrapper}>
      <span
        className={[
          styles.led,
          styles[`color-${color}`],
          blink ? styles.blink : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ width: size, height: size }}
        role="img"
        aria-label={label ?? `LED ${color}`}
      />
      {label !== undefined && <span className={styles.label}>{label}</span>}
    </span>
  );
}
