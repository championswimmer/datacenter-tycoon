import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  DEFAULT_START_SCREEN_LEADERBOARD_LIMIT,
  getLeaderboardMetricLabel,
  START_SCREEN_LEADERBOARD_TABS,
  type LeaderboardListResult,
  type LeaderboardQueryMetric,
} from "../../online/leaderboard.js";
import { useDialogFocus } from "../dialogFocus.js";
import styles from "./LeaderboardDialog.module.css";

interface LeaderboardDialogProps {
  activeMetric: LeaderboardQueryMetric;
  result: LeaderboardListResult | null;
  isLoading: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSelectMetric: (metric: LeaderboardQueryMetric) => void;
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
  activeMetric,
  result,
  isLoading,
  errorMessage,
  onClose,
  onSelectMetric,
  onRetry,
}: LeaderboardDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useDialogFocus(closeButtonRef);

  const heading = useMemo(
    () => `${getLeaderboardMetricLabel(activeMetric)} Leaderboard`,
    [activeMetric],
  );

  const subtitle = useMemo(() => {
    const limit = result?.limit ?? DEFAULT_START_SCREEN_LEADERBOARD_LIMIT;
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

        <div className={styles.tabBar}>
          <div className={styles.tabScroller}>
            <div className={styles.tabList} aria-label="Leaderboard metrics">
              {START_SCREEN_LEADERBOARD_TABS.map((tab) => {
                const isActive = tab.metric === activeMetric;

                return (
                  <button
                    key={tab.metric}
                    type="button"
                    className={[styles.tabButton, isActive ? styles.tabButtonActive : ""].join(" ")}
                    aria-pressed={isActive}
                    onClick={() => onSelectMetric(tab.metric)}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className={styles.body}>
          {isLoading ? (
            <div className={styles.stateMessage} role="status">
              Loading {getLeaderboardMetricLabel(activeMetric).toLowerCase()} leaderboard…
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
              {result.entries.map((entry) => {
                const detailItems = getLeaderboardEntryDetails(activeMetric, entry);

                return (
                  <li key={`${entry.playerId}-${entry.rank}-${entry.metric}`} className={styles.entryRow}>
                    <div className={styles.rankBadge}>#{entry.rank}</div>
                    <div className={styles.entryBody}>
                      <div className={styles.entryHeader}>
                        <span className={styles.username}>{entry.username}</span>
                        <span className={styles.value}>{formatMetricValue(activeMetric, entry.value)}</span>
                      </div>
                      {detailItems.length > 0 && (
                        <dl className={styles.detailGrid}>
                          {detailItems.map((item) => (
                            <div key={item.label} className={styles.detailItem}>
                              <dt className={styles.detailLabel}>{item.label}</dt>
                              <dd className={styles.detailValue}>{item.value}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                      <div className={styles.entryMeta}>
                        <span>{dateFormatter.format(new Date(entry.submittedAt))}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className={styles.stateMessage} role="status">
              No {getLeaderboardMetricLabel(activeMetric).toLowerCase()} leaderboard runs have been submitted yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function formatMetricValue(metric: LeaderboardQueryMetric, value: number): string {
  if (metric === "money" || metric === "cumulativeRevenue") {
    return currencyFormatter.format(value);
  }

  return numberFormatter.format(value);
}

function getLeaderboardEntryDetails(
  metric: LeaderboardQueryMetric,
  entry: LeaderboardListResult["entries"][number],
): Array<{ label: string; value: string }> {
  if (metric === "totalServers") {
    return [
      { label: "Compute", value: `${numberFormatter.format(entry.metrics.computeCapacity)} vCPU` },
      { label: "Memory", value: `${numberFormatter.format(entry.metrics.memoryCapacity)} GB` },
      { label: "Storage", value: `${numberFormatter.format(entry.metrics.storageCapacity)} TB` },
      { label: "GPU", value: `${numberFormatter.format(entry.metrics.gpuCapacity)} TFLOPS` },
    ];
  }

  if (metric === "cumulativeRevenue") {
    return [
      { label: "Cash", value: currencyFormatter.format(entry.metrics.money) },
      { label: "Played Through", value: `Month ${numberFormatter.format(entry.gameMonth)}` },
      { label: "Servers", value: numberFormatter.format(entry.metrics.totalServers) },
    ];
  }

  return [];
}
