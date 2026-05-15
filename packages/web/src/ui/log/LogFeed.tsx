import { useSelector } from "../../store/storeContext.js";
import { selectLedger } from "../../store/selectors.js";
import type { LedgerEntry, LedgerEntryType } from "@datacenter-tycoon/game-logic";
import { tickToGameDate, formatGameDateShort } from "../../store/gameTime.js";
import styles from "./LogFeed.module.css";

const LOG_LIMIT = 50;
const GITHUB_REPO_URL = "https://github.com/championswimmer/datacenter-tycoon";

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

function GitHubMarkIcon() {
  return (
    <svg
      className={styles.sourceIcon}
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8" />
    </svg>
  );
}

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

      <div className={styles.footer}>
        <a
          className={styles.sourceLink}
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noreferrer noopener"
          aria-label="View the Datacenter Tycoon source on GitHub"
          title="View source on GitHub"
        >
          <GitHubMarkIcon />
          <span className={styles.sourceText}>SOURCE ON GITHUB</span>
        </a>
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
