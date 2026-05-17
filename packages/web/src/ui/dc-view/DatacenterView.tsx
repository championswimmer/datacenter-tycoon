import { useGameDispatch, useSelector } from "../../store/storeContext.js";
import {
  selectActiveContracts,
  selectDatacenter,
  selectDatacenterFabricSummary,
  selectDatacenterInfrastructureSummary,
  selectDatacenterMaintenanceStaffingView,
  selectDatacenterMaintenanceView,
  selectDatacenterRackPowerSummary,
  selectDatacenterUpgradeSummary,
  selectRegionById,
  selectResourceUsage,
} from "../../store/selectors.js";
import { navigate, type DcTab } from "../../router/hashRouter.js";
import type { DatacenterId } from "@datacenter-tycoon/game-logic";
import { FloorView } from "../floor/FloorView.js";
import { PowerView } from "../stats/PowerView.js";
import { ResourceBars } from "../stats/ResourceBars.js";
import { ActiveList } from "../contracts/ActiveList.js";
import styles from "./DatacenterView.module.css";

interface DatacenterViewProps {
  dcId: string;
  tab: DcTab;
}

const TABS: { id: DcTab; label: string }[] = [
  { id: "floor", label: "FLOOR" },
  { id: "power", label: "RESOURCES" },
  { id: "contracts", label: "CONTRACTS" },
];

const EMPTY_USAGE = { powerKw: 0, heatOutputBtuPerHr: 0, bandwidthGbps: 0, slotsUsed: 0 };

export function DatacenterView({ dcId, tab }: DatacenterViewProps) {
  const datacenter = useSelector((state) => selectDatacenter(state, dcId as DatacenterId));
  const maintenance = useSelector((state) => selectDatacenterMaintenanceView(state, dcId as DatacenterId));
  const fabricSummary = useSelector((state) => selectDatacenterFabricSummary(state, dcId as DatacenterId));
  const maintenanceStaffing = useSelector((state) => selectDatacenterMaintenanceStaffingView(state, dcId as DatacenterId));
  const infrastructure = useSelector((state) => selectDatacenterInfrastructureSummary(state, dcId as DatacenterId));
  const upgradeSummary = useSelector((state) => selectDatacenterUpgradeSummary(state, dcId as DatacenterId));
  const rackPowerSummary = useSelector((state) => selectDatacenterRackPowerSummary(state, dcId as DatacenterId));
  const usageAgg = useSelector(selectResourceUsage);
  const region = useSelector((state) => datacenter ? selectRegionById(state, datacenter.regionId) : undefined);
  const dispatch = useGameDispatch();

  if (!datacenter) {
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

  const usage = usageAgg.perDc.find((entry) => entry.dcId === datacenter.id)?.usage ?? EMPTY_USAGE;
  const adjustMaintenanceStaff = (delta: number) => {
    if (!maintenanceStaffing) {
      return;
    }
    dispatch({
      type: "SetMaintenanceStaff",
      dcId: datacenter.id,
      maintenanceStaff: maintenanceStaffing.currentStaff + delta,
    });
  };

  return (
    <div className={styles.view}>
      <div className={styles.dcHeader}>
        <div className={styles.dcTitleRow}>
          <h2 className={styles.dcName}>{datacenter.name}</h2>
          <span className={styles.dcSpec}>{datacenter.spec.name}</span>
          {region && <span className={styles.dcRegion}>{region.code} · {region.city} · {region.name}</span>}
        </div>
        <div className={styles.resourceStrip}>
          <ResourceBars datacenter={datacenter} usage={usage} infrastructure={infrastructure} mode="compact" />
        </div>
        {maintenance && (
          <div className={styles.maintenanceStrip}>
            <span className={styles.maintenanceBadge}>MAINT {maintenance.maintenanceStaff}</span>
            <span className={styles.maintenanceMeta}>AVG AGE {maintenance.averageRackAgeMonths.toFixed(1)} MO</span>
            <span className={styles.maintenanceMeta}>
              {maintenance.repairingRackCount} REPAIRING / {maintenance.totalRackCount} TOTAL
            </span>
            {infrastructure && (
              <span className={styles.maintenanceMeta}>
                {infrastructure.effective.coolingType.toUpperCase()} · {infrastructure.effective.networkType.toUpperCase()}
              </span>
            )}
            {upgradeSummary && (
              <span className={styles.maintenanceMeta}>
                FABRIC {upgradeSummary.fabricEligible ? "READY" : "LOCKED"} · UPKEEP ${upgradeSummary.fixedMonthlyUpgradeOpex.toLocaleString()}/MO
              </span>
            )}
          </div>
        )}
        {upgradeSummary && (
          <div className={styles.upgradeStrip}>
            {upgradeSummary.tracks.map((track) => (
              <span key={track.trackId} className={styles.upgradeMeta}>
                {track.label.toUpperCase()}: {track.currentNode.label.toUpperCase()}
                {track.nextNode ? ` → ${track.nextNode.label.toUpperCase()}` : " · MAXED"}
              </span>
            ))}
          </div>
        )}
        {fabricSummary && (
          <div className={styles.fabricStrip}>
            <span className={styles.fabricBadge}>
              {fabricSummary.fabricConnected ? "FABRIC LINKED" : fabricSummary.fabricEligible ? "FABRIC READY" : "FABRIC LOCKED"}
            </span>
            <span className={styles.fabricMeta}>JOIN ${fabricSummary.joinCost.toLocaleString()}</span>
            <span className={styles.fabricMeta}>
              {fabricSummary.fabricConnected
                ? `${fabricSummary.memberDcIds.length} SITES IN POOL`
                : fabricSummary.linkBlockedReason ?? "Use the region panel to create the fabric."}
            </span>
          </div>
        )}
        {rackPowerSummary && rackPowerSummary.totalRackCount > 0 && (
          <div className={styles.activityStrip}>
            <span className={styles.activityBadge}>ACTIVE {rackPowerSummary.activeRackCount}</span>
            <span className={styles.activityMeta}>IDLE {rackPowerSummary.idleRackCount}</span>
            <span className={styles.activityMeta}>REPAIRING {rackPowerSummary.repairingRackCount}</span>
            <span className={styles.activityMeta}>BILLED {rackPowerSummary.billedPowerKw.toFixed(1)} kW</span>
            <span className={styles.activityMeta}>RESERVED {rackPowerSummary.reservedPowerKw.toFixed(1)} kW</span>
          </div>
        )}
        {maintenanceStaffing && (
          <div className={styles.maintenanceControls}>
            <div className={styles.maintenanceControlRow}>
              <span className={styles.maintenanceControlLabel}>Maintenance staffing</span>
              <div className={styles.maintenanceStepper}>
                <button
                  className={styles.maintenanceBtn}
                  onClick={() => adjustMaintenanceStaff(-1)}
                  disabled={!maintenanceStaffing.canDecrease}
                  aria-label="Decrease maintenance staff"
                >
                  −
                </button>
                <span className={styles.maintenanceValue}>{maintenanceStaffing.currentStaff}</span>
                <button
                  className={styles.maintenanceBtn}
                  onClick={() => adjustMaintenanceStaff(1)}
                  disabled={!maintenanceStaffing.canIncrease}
                  aria-label="Increase maintenance staff"
                >
                  +
                </button>
              </div>
            </div>
            <div className={styles.maintenanceHints}>
              <span>Extra wages ${maintenanceStaffing.extraWagesMonthly.toLocaleString()}/mo</span>
              <span>Repair speed {maintenanceStaffing.repairSpeedDaysPerTick.toFixed(0)} days/tick</span>
              {!maintenanceStaffing.canIncrease && maintenanceStaffing.currentStaff < maintenanceStaffing.maxStaff && (
                <span>Regional staff exhausted</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className={styles.tabBar} role="tablist">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            role="tab"
            aria-selected={tab === entry.id}
            className={[styles.tab, tab === entry.id ? styles.tabActive : ""].join(" ")}
            onClick={() => navigate({ view: "dc", dcId, tab: entry.id })}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className={styles.tabContent} role="tabpanel">
        <TabContent dcId={datacenter.id} tab={tab} />
      </div>
    </div>
  );
}

function TabContent({ dcId, tab }: { dcId: DatacenterId; tab: DcTab }) {
  if (tab === "floor") return <FloorView dcId={dcId} />;
  if (tab === "power") return <PowerView dcId={dcId} />;
  return <DcActiveContracts dcId={dcId} />;
}

function DcActiveContracts({ dcId }: { dcId: DatacenterId }) {
  const allActive = useSelector(selectActiveContracts);
  const dcContracts = allActive.filter((contract) => contract.assignedDcId === dcId);
  if (dcContracts.length === 0) {
    return (
      <div className={styles.placeholder}>
        <span className={styles.placeholderIcon}>📋</span>
        <p className={styles.placeholderLabel}>No Active Contracts</p>
        <p className={styles.placeholderPhase}>Accept contracts from the global Contracts page</p>
      </div>
    );
  }
  return (
    <div style={{ padding: "var(--space-5) var(--space-6)" }}>
      <ActiveList />
    </div>
  );
}
