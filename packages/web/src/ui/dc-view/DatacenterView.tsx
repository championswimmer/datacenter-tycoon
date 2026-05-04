import { MAX_MAINTENANCE_STAFF, repairProgressPerTick } from "@datacenter-tycoon/game-logic";
import { useGameDispatch, useSelector } from "../../store/storeContext.js";
import {
  selectActiveContracts,
  selectDatacenter,
  selectDatacenterMaintenanceView,
  selectRegionById,
  selectResourceUsage,
} from "../../store/selectors.js";
import { navigate, type DcTab } from "../../router/hashRouter.js";
import type { DatacenterId } from "@datacenter-tycoon/game-logic";
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
  const maintenance = useSelector(s => selectDatacenterMaintenanceView(s, dcId as DatacenterId));
  const usageAgg = useSelector(selectResourceUsage);
  const region   = useSelector(s => dc ? selectRegionById(s, dc.regionId) : undefined);
  const dispatch = useGameDispatch();

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
  const canDecreaseMaintenance = (maintenance?.maintenanceStaff ?? 0) > 0;
  const availableRegionalStaff = region ? Math.max(0, region.totalStaffAvailable - region.staffUsed) : 0;
  const canIncreaseMaintenance = Boolean(
    maintenance &&
      region &&
      maintenance.maintenanceStaff < MAX_MAINTENANCE_STAFF &&
      availableRegionalStaff > 0,
  );
  const maintenanceOpex = region && maintenance
    ? maintenance.maintenanceStaff * region.staffWage
    : 0;
  const repairSpeedDaysPerTick = maintenance
    ? repairProgressPerTick(maintenance.maintenanceStaff)
    : 0;
  const adjustMaintenanceStaff = (delta: number) => {
    if (!maintenance) {
      return;
    }
    dispatch({
      type: "SetMaintenanceStaff",
      dcId: dc.id,
      maintenanceStaff: maintenance.maintenanceStaff + delta,
    });
  };
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
        {maintenance && (
          <div className={styles.maintenanceStrip}>
            <span className={styles.maintenanceBadge}>MAINT {maintenance.maintenanceStaff}</span>
            <span className={styles.maintenanceMeta}>AVG AGE {maintenance.averageRackAgeMonths.toFixed(1)} MO</span>
            <span className={styles.maintenanceMeta}>
              {maintenance.repairingRackCount} REPAIRING / {maintenance.totalRackCount} TOTAL
            </span>
          </div>
        )}
        {maintenance && (
          <div className={styles.maintenanceControls}>
            <div className={styles.maintenanceControlRow}>
              <span className={styles.maintenanceControlLabel}>Maintenance staffing</span>
              <div className={styles.maintenanceStepper}>
                <button
                  className={styles.maintenanceBtn}
                  onClick={() => adjustMaintenanceStaff(-1)}
                  disabled={!canDecreaseMaintenance}
                  aria-label="Decrease maintenance staff"
                >
                  −
                </button>
                <span className={styles.maintenanceValue}>{maintenance.maintenanceStaff}</span>
                <button
                  className={styles.maintenanceBtn}
                  onClick={() => adjustMaintenanceStaff(1)}
                  disabled={!canIncreaseMaintenance}
                  aria-label="Increase maintenance staff"
                >
                  +
                </button>
              </div>
            </div>
            <div className={styles.maintenanceHints}>
              <span>Extra wages ${maintenanceOpex.toLocaleString()}/mo</span>
              <span>Repair speed {repairSpeedDaysPerTick.toFixed(0)} days/tick</span>
              {region && !canIncreaseMaintenance && maintenance.maintenanceStaff < MAX_MAINTENANCE_STAFF && (
                <span>Regional staff exhausted</span>
              )}
            </div>
          </div>
        )}
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
