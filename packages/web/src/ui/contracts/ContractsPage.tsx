import { useState } from "react";
import { MarketList } from "./MarketList.js";
import { ActiveList } from "./ActiveList.js";
import { useSelector } from "../../store/storeContext.js";
import { selectMarket, selectActiveContracts } from "../../store/selectors.js";
import styles from "./ContractsPage.module.css";

type ContractsTab = "market" | "active";

export function ContractsPage() {
  const [tab, setTab] = useState<ContractsTab>("market");

  const market   = useSelector(selectMarket);
  const active   = useSelector(selectActiveContracts);

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <h2 className={styles.title}>CONTRACTS</h2>
      </div>

      {/* ── Tabs ── */}
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
      </div>

      {/* ── Content ── */}
      <div className={styles.content} role="tabpanel">
        {tab === "market" ? <MarketList /> : <ActiveList />}
      </div>
    </div>
  );
}
