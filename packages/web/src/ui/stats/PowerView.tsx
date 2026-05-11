import type { DatacenterId } from "@datacenter-tycoon/game-logic";
import { useSelector } from "../../store/storeContext.js";
import {
  selectDatacenter,
  selectDatacenterCapacitySummary,
  selectDatacenterRackPowerSummary,
  selectOpexBreakdown,
  selectResourceUsage,
} from "../../store/selectors.js";
import { ResourceBars } from "./ResourceBars.js";
import { CapacityTiles } from "./CapacityTiles.js";
import { OpexCard } from "./OpexCard.js";
import { CashSparkline } from "./CashSparkline.js";
import styles from "./PowerView.module.css";

interface PowerViewProps {
  dcId: DatacenterId;
}

const EMPTY_CAPACITY = { vCpu: 0, ramGb: 0, storageTb: 0, gpuFlops: 0 };
const EMPTY_USAGE = { powerKw: 0, heatOutputBtuPerHr: 0, bandwidthGbps: 0, slotsUsed: 0 };

export function PowerView({ dcId }: PowerViewProps) {
  const datacenter = useSelector((state) => selectDatacenter(state, dcId));
  const capacitySummary = useSelector((state) => selectDatacenterCapacitySummary(state, dcId));
  const opexAgg = useSelector(selectOpexBreakdown);
  const usageAgg = useSelector(selectResourceUsage);
  const rackPowerSummary = useSelector((state) => selectDatacenterRackPowerSummary(state, dcId));

  if (!datacenter) return null;

  const usage = usageAgg.perDc.find((entry) => entry.dcId === dcId)?.usage ?? EMPTY_USAGE;
  const opexEntry = opexAgg.perDc.find((entry) => entry.dcId === dcId);
  const dcCapacity = capacitySummary?.usable ?? EMPTY_CAPACITY;
  const dcFree = capacitySummary?.available ?? EMPTY_CAPACITY;

  return (
    <div className={styles.view}>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>RESOURCE UTILIZATION</h3>
        <ResourceBars datacenter={datacenter} usage={usage} mode="full" />
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>RACK CAPACITY</h3>
        <CapacityTiles total={dcCapacity} free={dcFree} />
      </section>

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

      <div className={styles.bottom}>
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>OPEX BREAKDOWN</h3>
          {opexEntry && opexEntry.result.total > 0 ? (
            <OpexCard total={opexEntry.result.total} breakdown={opexEntry.result.breakdown} />
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
