import { useMemo, useState } from "react";
import { MarketList } from "./MarketList.js";
import { ActiveList } from "./ActiveList.js";
import { CompletedList } from "./CompletedList.js";
import { useSelector } from "../../store/storeContext.js";
import {
  selectActiveContracts,
  selectHistoricalContracts,
  selectMarketContractViews,
  selectReliabilitySummary,
  selectReliabilityMarketEffectSummary,
} from "../../store/selectors.js";
import styles from "./ContractsPage.module.css";

type ContractsTab = "market" | "active" | "history";
type SortKey = "payment" | "term" | "expiry" | "score";
type FilterKey = "all" | "fits" | "highValue" | "rush" | "anchor";

const SORT_LABELS: Record<SortKey, string> = {
  payment: "PAYMENT",
  term: "TERM",
  expiry: "EXPIRY",
  score: "DEAL SCORE",
};

const FILTER_LABELS: Record<FilterKey, string> = {
  all: "ALL",
  fits: "FITS NOW",
  highValue: "HIGH VALUE",
  rush: "RUSH",
  anchor: "LONG TERM",
};

export function ContractsPage() {
  const [tab, setTab] = useState<ContractsTab>("market");
  const [sortKey, setSortKey] = useState<SortKey>("expiry");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filter, setFilter] = useState<FilterKey>("all");

  const marketViews = useSelector(selectMarketContractViews);
  const active = useSelector(selectActiveContracts);
  const history = useSelector(selectHistoricalContracts);
  const reliability = useSelector(selectReliabilitySummary);
  const reliabilityFx = useSelector(selectReliabilityMarketEffectSummary);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "expiry" ? "asc" : "desc");
    }
  };

  const filteredAndSorted = useMemo(() => {
    let list = [...marketViews];

    if (filter === "fits") {
      list = list.filter((view) => view.fitSummary.fitStatus === "fits");
    } else if (filter === "highValue") {
      list = list.filter((view) => view.dealScore >= 1.2);
    } else if (filter === "rush") {
      list = list.filter((view) => view.contract.urgency === "rush");
    } else if (filter === "anchor") {
      list = list.filter((view) => view.contract.urgency === "anchor");
    }

    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      switch (sortKey) {
        case "payment":
          return dir * (a.contract.monthlyPayment - b.contract.monthlyPayment);
        case "term":
          return dir * (a.contract.termMonths - b.contract.termMonths);
        case "expiry":
          return dir * (a.contract.expiresAtTick - b.contract.expiresAtTick);
        case "score":
          return dir * (a.dealScore - b.dealScore);
      }
    });

    return list;
  }, [filter, marketViews, sortDir, sortKey]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>CONTRACTS</h2>
        <div className={styles.reliabilityPanel}>
          <div className={styles.reliabilityScoreBlock}>
            <span className={styles.reliabilityLabel}>RELIABILITY OUTLOOK</span>
            <span className={[
              styles.reliabilityScore,
              (reliability.band === "platinum" || reliability.band === "diamond")
                ? styles.reliabilityTrusted
                : (reliability.band === "silver" || reliability.band === "bronze")
                  ? styles.reliabilityAtRisk
                  : styles.reliabilityBaseline,
            ].join(" ")}>{reliability.score} · {reliability.band.toUpperCase()}</span>
            <span className={styles.reliabilityTrend}>
              {reliability.lastDelta > 0
                ? `▲ +${reliability.lastDelta} last tick`
                : reliability.lastDelta < 0
                  ? `▼ ${reliability.lastDelta} last tick`
                  : "— steady last tick"}
            </span>
          </div>
          <div className={styles.reliabilityCopy}>
            <p className={styles.reliabilitySummary}>{reliabilityFx.summary}</p>
            <div className={styles.reliabilityEffects}>
              <span className={styles.reliabilityEffectChip}>{reliabilityFx.supplyLabel}</span>
              <span className={styles.reliabilityEffectChip}>{reliabilityFx.termLabel}</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.tabBar} role="tablist">
        <button
          role="tab"
          aria-selected={tab === "market"}
          className={[styles.tab, tab === "market" ? styles.tabActive : ""].join(" ")}
          onClick={() => setTab("market")}
        >
          MARKET
          <span className={styles.badge}>{marketViews.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === "active"}
          className={[styles.tab, tab === "active" ? styles.tabActive : ""].join(" ")}
          onClick={() => setTab("active")}
        >
          ACTIVE
          <span className={[
            styles.badge,
            active.some((contract) => contract.lifecycleState === "breached") ? styles.badgeRed : "",
          ].join(" ")}>
            {active.length}
          </span>
        </button>
        <button
          role="tab"
          aria-selected={tab === "history"}
          className={[styles.tab, tab === "history" ? styles.tabActive : ""].join(" ")}
          onClick={() => setTab("history")}
        >
          HISTORY
          <span className={styles.badge}>{history.length}</span>
        </button>
      </div>

      {tab === "market" && (
        <div className={styles.controls}>
          <div className={styles.sortRow}>
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
              <button
                key={key}
                className={[styles.sortBtn, sortKey === key ? styles.sortBtnActive : ""].join(" ")}
                onClick={() => handleSort(key)}
              >
                {SORT_LABELS[key]}
                {sortKey === key && (
                  <span className={styles.sortDir}>{sortDir === "asc" ? " ▲" : " ▼"}</span>
                )}
              </button>
            ))}
          </div>
          <div className={styles.filterRow}>
            {(Object.keys(FILTER_LABELS) as FilterKey[]).map((key) => (
              <button
                key={key}
                className={[styles.filterPill, filter === key ? styles.filterPillActive : ""].join(" ")}
                onClick={() => setFilter((current) => (current === key ? "all" : key))}
              >
                {FILTER_LABELS[key]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={styles.content} role="tabpanel">
        {tab === "market" && <MarketList contractViews={filteredAndSorted} />}
        {tab === "active" && <ActiveList />}
        {tab === "history" && <CompletedList />}
      </div>
    </div>
  );
}
