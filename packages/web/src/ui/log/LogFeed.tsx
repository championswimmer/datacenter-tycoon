import { useSelector } from "../../store/storeContext.js";
import { selectLedger } from "../../store/selectors.js";
import type { LedgerEntry, LedgerEntryType } from "@datacenter-tycoon/game-logic";
import { tickToGameDate, formatGameDateShort } from "../../store/gameTime.js";
import styles from "./LogFeed.module.css";

const LOG_LIMIT = 50;

function formatAmount(entry: LedgerEntry): string {
  const n = entry.amount;
  const abs = Math.abs(n);
  const sign = n >= 0 ? "+" : "-";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toLocaleString()}`;
}

const TYPE_LABEL: Record<LedgerEntryType, string> = {
  capex:      "CAPEX",
  opex:       "OPEX",
  revenue:    "REV",
  penalty:    "PEN",
  adjustment: "ADJ",
};

export function LogFeed() {
  const entries = useSelector(s => selectLedger(s, LOG_LIMIT));

  return (
    <div className={styles.feed}>
      <div className={styles.header}>
        <span className={styles.headerLabel}>EVENT LOG</span>
        <span className={styles.count}>{entries.length}</span>
      </div>

      <div className={styles.list} role="log" aria-live="polite" aria-label="Game event log">
        {entries.length === 0 && (
          <div className={styles.empty}>Awaiting events…</div>
        )}
        {entries.map(entry => (
          <LogRow key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}

function LogRow({ entry }: { entry: LedgerEntry }) {
  return (
    <div className={[styles.row, styles[`type-${entry.type}`]].join(" ")}>
      <div className={styles.rowTop}>
        <span className={styles.typePill}>{TYPE_LABEL[entry.type]}</span>
        <span className={styles.amount}>{formatAmount(entry)}</span>
        <span className={styles.tick}>{formatGameDateShort(tickToGameDate(entry.tick))}</span>
      </div>
      <div className={styles.reason}>{entry.reason}</div>
    </div>
  );
}
