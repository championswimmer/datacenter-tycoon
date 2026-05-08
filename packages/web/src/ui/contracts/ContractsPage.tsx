import { useState, useMemo } from "react";
import type { Contract } from "@datacenter-tycoon/game-logic";
import { MarketList } from "./MarketList.js";
import { ActiveList } from "./ActiveList.js";
import { CompletedList } from "./CompletedList.js";
import { useSelector } from "../../store/storeContext.js";
import {
  selectMarket,
  selectActiveContracts,
  selectAllDatacenters,
  selectReliabilitySummary,
  selectReliabilityMarketEffectSummary,
} from "../../store/selectors.js";
import { contractDealScore, canFulfill, dcFreeCapacity } from "./contractUtils.js";
import styles from "./ContractsPage.module.css";

type ContractsTab = "market" | "active" | "completed";
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

  const market   = useSelector(selectMarket);
  const active   = useSelector(selectActiveContracts);
  const datacenters = useSelector(selectAllDatacenters);
  const reliability = useSelector(selectReliabilitySummary);
  const reliabilityFx = useSelector(selectReliabilityMarketEffectSummary);
  const activeAll = useSelector((s: import("@datacenter-tycoon/game-logic").GameState) =>
    s.activeContracts.filter(c => c.status === "completed" || c.status === "cancelled")
  );

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "expiry" ? "asc" : "desc");
    }
  };

  const filteredAndSorted = useMemo(() => {
    let list = [...market];

    if (filter === "fits") {
      list = list.filter(c => {
        return datacenters.some(dc => {
          const free = dcFreeCapacity(dc, active);
          return canFulfill(free, c.requirements);
        });
      });
    } else if (filter === "highValue") {
      list = list.filter(c => contractDealScore(c) >= 1.2);
    } else if (filter === "rush") {
      list = list.filter(c => c.urgency === "rush");
    } else if (filter === "anchor") {
      list = list.filter(c => c.urgency === "anchor");
    }

    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      switch (sortKey) {
        case "payment": return dir * (a.monthlyPayment - b.monthlyPayment);
        case "term":    return dir * (a.termMonths - b.termMonths);
        case "expiry":  return dir * (a.expiresAtTick - b.expiresAtTick);
        case "score":   return dir * (contractDealScore(a) - contractDealScore(b));
      }
    });

    return list;
  }, [market, datacenters, active, sortKey, sortDir, filter]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>CONTRACTS</h2>
        <div className={styles.reliabilityPanel}>
          <div className={styles.reliabilityScoreBlock}>
            <span className={styles.reliabilityLabel}>RELIABILITY OUTLOOK</span>
            <span className={[
              styles.reliabilityScore,
              reliability.band === "trusted"
                ? styles.reliabilityTrusted
                : reliability.band === "at-risk"
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
          <span className={styles.badge}>{market.length}</span>
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
            active.some(c => c.status === "breached") ? styles.badgeRed : "",
          ].join(" ")}>
            {active.length}
          </span>
        </button>
        <button
          role="tab"
          aria-selected={tab === "completed"}
          className={[styles.tab, tab === "completed" ? styles.tabActive : ""].join(" ")}
          onClick={() => setTab("completed")}
        >
          COMPLETED
          <span className={styles.badge}>{activeAll.length}</span>
        </button>
      </div>

      {tab === "market" && (
        <div className={styles.controls}>
          <div className={styles.sortRow}>
            {(Object.keys(SORT_LABELS) as SortKey[]).map(key => (
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
            {(Object.keys(FILTER_LABELS) as FilterKey[]).map(key => (
              <button
                key={key}
                className={[styles.filterPill, filter === key ? styles.filterPillActive : ""].join(" ")}
                onClick={() => setFilter(f => f === key ? "all" : key)}
              >
                {FILTER_LABELS[key]}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={styles.content} role="tabpanel">
        {tab === "market" && <MarketList contracts={filteredAndSorted} />}
        {tab === "active" && <ActiveList />}
        {tab === "completed" && <CompletedList />}
      </div>
    </div>
  );
}
