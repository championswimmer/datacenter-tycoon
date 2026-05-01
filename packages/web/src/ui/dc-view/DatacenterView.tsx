import { useSelector } from "../../store/storeContext.js";
import { selectDatacenter } from "../../store/selectors.js";
import { navigate, type DcTab } from "../../router/hashRouter.js";
import type { DatacenterId } from "@datacenter-tycoon/game-logic";
import styles from "./DatacenterView.module.css";

interface DatacenterViewProps {
  dcId: string;
  tab:  DcTab;
}

const TABS: { id: DcTab; label: string }[] = [
  { id: "floor",     label: "FLOOR" },
  { id: "power",     label: "POWER" },
  { id: "contracts", label: "CONTRACTS" },
];

export function DatacenterView({ dcId, tab }: DatacenterViewProps) {
  const dc = useSelector(s => selectDatacenter(s, dcId as DatacenterId));

  if (!dc) {
    return (
      <div className={styles.notFound}>
        <span className={styles.notFoundIcon}>⚠</span>
        <p>Datacenter <code>{dcId}</code> not found.</p>
        <button className={styles.backBtn} onClick={() => navigate({ view: "home" })}>
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div className={styles.view}>
      {/* ── DC header ── */}
      <div className={styles.dcHeader}>
        <div className={styles.dcTitleRow}>
          <h2 className={styles.dcName}>{dc.name}</h2>
          <span className={styles.dcSpec}>{dc.spec.name}</span>
        </div>
        <div className={styles.dcMeta}>
          <span className={styles.metaItem}>
            {dc.spec.rows} rows × {dc.spec.positionsPerRow} slots
          </span>
          <span className={styles.metaDot}>·</span>
          <span className={styles.metaItem}>{dc.spec.powerCapacityKw} kW</span>
          <span className={styles.metaDot}>·</span>
          <span className={styles.metaItem}>{dc.spec.coolingType} cooling</span>
          <span className={styles.metaDot}>·</span>
          <span className={styles.metaItem}>{dc.spec.bandwidthGbps} Gbps</span>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className={styles.tabBar} role="tablist">
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={[styles.tab, tab === t.id ? styles.tabActive : ""].join(" ")}
            onClick={() => navigate({ view: "dc", dcId, tab: t.id })}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className={styles.tabContent} role="tabpanel">
        <TabContent dcId={dc.id} tab={tab} />
      </div>
    </div>
  );
}

function TabContent({ dcId, tab }: { dcId: DatacenterId; tab: DcTab }) {
  // Phases 6 & 7 will replace these placeholders
  const placeholders: Record<DcTab, { icon: string; label: string; phase: string }> = {
    floor:     { icon: "▦", label: "Rack Floor",         phase: "Phase 6" },
    power:     { icon: "⚡", label: "Power & Cooling",    phase: "Phase 7" },
    contracts: { icon: "📋", label: "Datacenter Contracts", phase: "Phase 8" },
  };
  const { icon, label, phase } = placeholders[tab];
  return (
    <div className={styles.placeholder}>
      <span className={styles.placeholderIcon}>{icon}</span>
      <p className={styles.placeholderLabel}>{label}</p>
      <p className={styles.placeholderPhase}>Implemented in {phase}</p>
      <code className={styles.placeholderDcId}>{dcId}</code>
    </div>
  );
}
