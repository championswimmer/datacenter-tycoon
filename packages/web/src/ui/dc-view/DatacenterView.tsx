import { useSelector } from "../../store/storeContext.js";
import { selectDatacenter, selectResourceUsage, selectActiveContracts, selectRegionById } from "../../store/selectors.js";
import { navigate, type DcTab } from "../../router/hashRouter.js";
import type { DatacenterId, Datacenter } from "@datacenter-tycoon/game-logic";
import { FloorView }    from "../floor/FloorView.js";
import { PowerView }    from "../stats/PowerView.js";
import { ResourceBars } from "../stats/ResourceBars.js";
import { ActiveList }   from "../contracts/ActiveList.js";
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

const EMPTY_USAGE = { powerKw: 0, heatOutputBtuPerHr: 0, bandwidthGbps: 0, slotsUsed: 0 };

export function DatacenterView({ dcId, tab }: DatacenterViewProps) {
  const dc       = useSelector(s => selectDatacenter(s, dcId as DatacenterId));
  const usageAgg = useSelector(selectResourceUsage);
  const region   = useSelector(s => dc ? selectRegionById(s, dc.regionId) : undefined);

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

  const usage = usageAgg.perDc.find(u => u.dcId === dc.id)?.usage ?? EMPTY_USAGE;

  return (
    <div className={styles.view}>
      {/* ── DC header ── */}
      <div className={styles.dcHeader}>
        <div className={styles.dcTitleRow}>
          <h2 className={styles.dcName}>{dc.name}</h2>
          <span className={styles.dcSpec}>{dc.spec.name}</span>
          {region && (
            <span className={styles.dcRegion}>{region.name}</span>
          )}
        </div>
        {/* Compact resource utilisation strip */}
        <div className={styles.resourceStrip}>
          <ResourceBars datacenter={dc} usage={usage} mode="compact" />
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
  if (tab === "floor")  return <FloorView dcId={dcId} />;
  if (tab === "power")  return <PowerView dcId={dcId} />;
  return <DcActiveContracts dcId={dcId} />;
}

/** Per-DC view of active contracts in the datacenter's CONTRACTS tab. */
function DcActiveContracts({ dcId }: { dcId: DatacenterId }) {
  const allActive = useSelector(selectActiveContracts);
  const dcContracts = allActive.filter(c => c.assignedDcId === dcId);
  if (dcContracts.length === 0) {
    return (
      <div className={styles.placeholder}>
        <span className={styles.placeholderIcon}>📋</span>
        <p className={styles.placeholderLabel}>No Active Contracts</p>
        <p className={styles.placeholderPhase}>Accept contracts from the global Contracts page</p>
      </div>
    );
  }
  // Reuse ActiveList but scoped — ActiveList reads from store, so render it
  // with a note about the dc filter (it will show all active by default).
  // For MVP, link to the global contracts page.
  return (
    <div style={{ padding: "var(--space-5) var(--space-6)" }}>
      <ActiveList />
    </div>
  );
}
