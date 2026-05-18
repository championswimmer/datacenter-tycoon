import type { DatacenterId } from "@datacenter-tycoon/game-logic";
import { useSelector } from "../../store/storeContext.js";
import {
  selectDatacenter,
  selectDatacenterCapacitySummary,
  selectDatacenterFabricCapacitySummary,
  selectDatacenterFabricSummary,
  selectDatacenterInfrastructureSummary,
  selectDatacenterOpex,
  selectDatacenterRackPowerSummary,
  selectDatacenterResourceUsage,
  selectDatacenterUpgradeSummary,
} from "../../store/selectors.js";
import { ResourceBars } from "./ResourceBars.js";
import { CapacityTiles } from "./CapacityTiles.js";
import { OpexCard } from "./OpexCard.js";
import { CashSparkline } from "./CashSparkline.js";
import { UpgradePanel } from "./UpgradePanel.js";
import styles from "./PowerView.module.css";

interface PowerViewProps {
  dcId: DatacenterId;
}

const EMPTY_CAPACITY = { vCpu: 0, ramGb: 0, storageTb: 0, gpuFlops: 0 };
const EMPTY_USAGE = { powerKw: 0, heatOutputBtuPerHr: 0, bandwidthGbps: 0, slotsUsed: 0 };

export function PowerView({ dcId }: PowerViewProps) {
  const datacenter = useSelector((state) => selectDatacenter(state, dcId));
  const capacitySummary = useSelector((state) => selectDatacenterCapacitySummary(state, dcId));
  const fabricCapacitySummary = useSelector((state) => selectDatacenterFabricCapacitySummary(state, dcId));
  const fabricSummary = useSelector((state) => selectDatacenterFabricSummary(state, dcId));
  const infrastructure = useSelector((state) => selectDatacenterInfrastructureSummary(state, dcId));
  const upgradeSummary = useSelector((state) => selectDatacenterUpgradeSummary(state, dcId));
  const opexEntry = useSelector((state) => selectDatacenterOpex(state, dcId));
  const usage = useSelector((state) => selectDatacenterResourceUsage(state, dcId) ?? EMPTY_USAGE);
  const rackPowerSummary = useSelector((state) => selectDatacenterRackPowerSummary(state, dcId));

  if (!datacenter) return null;

  const showingPooledCapacity = fabricCapacitySummary?.connected ?? false;
  const dcCapacity = showingPooledCapacity
    ? fabricCapacitySummary?.usable ?? EMPTY_CAPACITY
    : capacitySummary?.usable ?? EMPTY_CAPACITY;
  const dcFree = showingPooledCapacity
    ? fabricCapacitySummary?.available ?? EMPTY_CAPACITY
    : capacitySummary?.available ?? EMPTY_CAPACITY;

  return (
    <div className={styles.view}>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>RESOURCE UTILIZATION</h3>
        <ResourceBars datacenter={datacenter} usage={usage} infrastructure={infrastructure} mode="full" />
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>RACK CAPACITY</h3>
        <CapacityTiles
          total={dcCapacity}
          free={dcFree}
          modeLabel={showingPooledCapacity ? "REGIONAL FABRIC POOL" : "LOCAL SITE CAPACITY"}
          detail={showingPooledCapacity
            ? `${fabricCapacitySummary?.memberDcIds.length ?? 1}-site pooled block available to this datacenter`
            : fabricSummary?.fabricEligible
              ? "Upgrade-complete site; join from the region panel to pool capacity"
              : fabricSummary?.fabricIneligibilityReason ?? "Standalone capacity only"}
        />
      </section>

      {fabricSummary && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>REGIONAL FABRIC STATUS</h3>
          <div className={styles.powerSplitGrid}>
            <div className={styles.powerSplitCard}>
              <span className={styles.powerSplitLabel}>Fabric state</span>
              <span className={styles.powerSplitValue}>
                {fabricSummary.fabricConnected ? "LINKED" : fabricSummary.fabricEligible ? "READY" : "LOCKED"}
              </span>
              <span className={styles.powerSplitHint}>
                {fabricSummary.fabricConnected
                  ? `${fabricSummary.memberDcIds.length} linked datacenters share one pool`
                  : fabricSummary.linkBlockedReason ?? "Join from the region panel"}
              </span>
            </div>
            <div className={styles.powerSplitCard}>
              <span className={styles.powerSplitLabel}>Join cost</span>
              <span className={styles.powerSplitValue}>${fabricSummary.joinCost.toLocaleString()}</span>
              <span className={styles.powerSplitHint}>Charged once for each new fabric connection investment</span>
            </div>
          </div>
        </section>
      )}

      {infrastructure && upgradeSummary && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>EFFECTIVE INFRASTRUCTURE</h3>
          <div className={styles.powerSplitGrid}>
            <div className={styles.powerSplitCard}>
              <span className={styles.powerSplitLabel}>Grid import</span>
              <span className={styles.powerSplitValue}>{infrastructure.effective.gridImportCapacityKw.toFixed(0)} kW</span>
              <span className={styles.powerSplitHint}>Base reserved utility capacity</span>
            </div>
            <div className={styles.powerSplitCard}>
              <span className={styles.powerSplitLabel}>Onsite generation</span>
              <span className={styles.powerSplitValue}>{infrastructure.effective.onsiteGenerationCapacityKw.toFixed(0)} kW</span>
              <span className={styles.powerSplitHint}>Local rack headroom from installed generators</span>
            </div>
            <div className={styles.powerSplitCard}>
              <span className={styles.powerSplitLabel}>Cooling mode</span>
              <span className={styles.powerSplitValue}>{infrastructure.effective.coolingType.toUpperCase()}</span>
              <span className={styles.powerSplitHint}>{Math.round(infrastructure.base.coolingCapacityBtuPerHr).toLocaleString()} → {Math.round(infrastructure.effective.coolingCapacityBtuPerHr).toLocaleString()} BTU/hr</span>
            </div>
            <div className={styles.powerSplitCard}>
              <span className={styles.powerSplitLabel}>Network type</span>
              <span className={styles.powerSplitValue}>{infrastructure.effective.networkType.toUpperCase()}</span>
              <span className={styles.powerSplitHint}>{infrastructure.base.bandwidthGbps} → {infrastructure.effective.bandwidthGbps} Gbps · Fabric {upgradeSummary.fabricEligible ? "ready" : "locked"}</span>
            </div>
          </div>
        </section>
      )}

      {rackPowerSummary && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>POWER BILLING MODEL</h3>
          <div className={styles.powerSplitGrid}>
            <div className={styles.powerSplitCard}>
              <span className={styles.powerSplitLabel}>Reserved power</span>
              <span className={styles.powerSplitValue}>{rackPowerSummary.reservedPowerKw.toFixed(1)} kW</span>
              <span className={styles.powerSplitHint}>Placement limit guardrail (full rack draw)</span>
            </div>
            <div className={styles.powerSplitCard}>
              <span className={styles.powerSplitLabel}>Billed power</span>
              <span className={styles.powerSplitValue}>{rackPowerSummary.billedPowerKw.toFixed(1)} kW</span>
              <span className={styles.powerSplitHint}>Electricity charged this month</span>
            </div>
            <div className={styles.powerSplitCard}>
              <span className={styles.powerSplitLabel}>Idle baseline</span>
              <span className={styles.powerSplitValue}>{rackPowerSummary.idleBaselinePowerKw.toFixed(1)} kW</span>
              <span className={styles.powerSplitHint}>{rackPowerSummary.idleRackCount} idle / {rackPowerSummary.repairingRackCount} repairing racks</span>
            </div>
            <div className={styles.powerSplitCard}>
              <span className={styles.powerSplitLabel}>Active draw</span>
              <span className={styles.powerSplitValue}>{rackPowerSummary.activePowerKw.toFixed(1)} kW</span>
              <span className={styles.powerSplitHint}>{rackPowerSummary.activeRackCount} active racks serving contracts</span>
            </div>
          </div>
          <p className={styles.powerExplainer}>
            Racks always reserve full power capacity for placement checks. Billing uses usage-aware draw:
            idle and repairing racks pay only baseline power, while active racks pay full spec draw.
          </p>
        </section>
      )}

      {upgradeSummary && <UpgradePanel dcId={dcId} />}

      <div className={styles.bottom}>
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>OPEX BREAKDOWN</h3>
          {opexEntry && opexEntry.total > 0 ? (
            <OpexCard total={opexEntry.total} breakdown={opexEntry.breakdown} />
          ) : (
            <p className={styles.none}>No operating costs yet — install racks to generate opex.</p>
          )}
        </section>

        <section className={styles.section}>
          <CashSparkline />
        </section>
      </div>
    </div>
  );
}
