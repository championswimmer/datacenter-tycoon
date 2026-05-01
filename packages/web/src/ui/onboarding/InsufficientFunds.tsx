import styles from "./InsufficientFunds.module.css";

interface InsufficientFundsProps {
  /** How much more cash is needed (positive number). */
  shortfall: number;
  /** Render as a compact inline badge (default) vs a larger block. */
  size?: "sm" | "md";
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

export function InsufficientFunds({ shortfall, size = "sm" }: InsufficientFundsProps) {
  return (
    <span
      className={[styles.badge, styles[`size-${size}`]].join(" ")}
      role="status"
      aria-label={`Insufficient funds — need ${formatMoney(shortfall)} more`}
    >
      <span className={styles.icon}>⚠</span>
      Need {formatMoney(shortfall)} more
    </span>
  );
}
