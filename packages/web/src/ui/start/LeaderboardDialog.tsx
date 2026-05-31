import { useCallback, useEffect, useMemo, useRef } from "react";
import type { LeaderboardListResult } from "../../online/leaderboard.js";
import { useDialogFocus } from "../dialogFocus.js";
import styles from "./LeaderboardDialog.module.css";

interface LeaderboardDialogProps {
  result: LeaderboardListResult | null;
  isLoading: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onRetry: () => void;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
});

export function LeaderboardDialog({
  result,
  isLoading,
  errorMessage,
  onClose,
  onRetry,
}: LeaderboardDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useDialogFocus(closeButtonRef);

  const heading = useMemo(() => {
    if (!result) {
      return "Online Leaderboard";
    }

    return `${formatMetricLabel(result.metric)} Leaderboard`;
  }, [result]);

  const subtitle = useMemo(() => {
    const limit = result?.limit ?? 10;
    return `Top ${limit} runs across all time`;
  }, [result]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleClose]);

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          handleClose();
        }
      }}
    >
      <section
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="leaderboard-dialog-title"
        aria-describedby="leaderboard-dialog-description"
      >
        <header className={styles.header}>
          <div>
            <h2 id="leaderboard-dialog-title" className={styles.title}>{heading}</h2>
            <p id="leaderboard-dialog-description" className={styles.subtitle}>{subtitle}</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeButton}
            onClick={handleClose}
            aria-label="Close leaderboard"
          >
            ✕
          </button>
        </header>

        <div className={styles.content}>
          {isLoading ? (
            <div className={styles.stateMessage} role="status">
              Loading leaderboard…
            </div>
          ) : errorMessage ? (
            <div className={styles.stateStack}>
              <div className={styles.errorMessage} role="alert">
                {errorMessage}
              </div>
              <button type="button" className={styles.retryButton} onClick={onRetry}>
                Retry
              </button>
            </div>
          ) : result && result.entries.length > 0 ? (
            <ol className={styles.entryList}>
              {result.entries.map((entry) => (
                <li key={`${entry.playerId}-${entry.rank}`} className={styles.entryRow}>
                  <div className={styles.rankBadge}>#{entry.rank}</div>
                  <div className={styles.entryBody}>
                    <div className={styles.entryHeader}>
                      <span className={styles.username}>{entry.username}</span>
                      <span className={styles.value}>{formatMetricValue(entry.metric, entry.value)}</span>
                    </div>
                    <div className={styles.entryMeta}>
                      <span>Month {numberFormatter.format(entry.gameMonth)}</span>
                      <span>{dateFormatter.format(new Date(entry.submittedAt))}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className={styles.stateMessage} role="status">
              No leaderboard runs have been submitted yet. Start a game and claim the top spot.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function formatMetricLabel(metric: NonNullable<LeaderboardListResult["metric"]>): string {
  switch (metric) {
    case "money":
      return "Cash";
    case "cumulativeRevenue":
      return "Revenue";
    case "totalServers":
      return "Servers";
    case "computeCapacity":
      return "Compute";
    case "memoryCapacity":
      return "Memory";
    case "storageCapacity":
      return "Storage";
    case "gpuCapacity":
      return "GPU";
    case "totalCapacity":
      return "Total Capacity";
    default:
      return metric;
  }
}

function formatMetricValue(metric: LeaderboardListResult["metric"], value: number): string {
  if (metric === "money" || metric === "cumulativeRevenue") {
    return currencyFormatter.format(value);
  }

  return numberFormatter.format(value);
}
