import type { DatacenterId } from "@datacenter-tycoon/game-logic";
import { useSelector } from "../../store/storeContext.js";
import {
  selectDatacenter,
  selectCapacity,
  selectFreeCapacity,
  selectOpexBreakdown,
  selectResourceUsage,
} from "../../store/selectors.js";
import { ResourceBars }   from "./ResourceBars.js";
import { CapacityTiles }  from "./CapacityTiles.js";
import { OpexCard }       from "./OpexCard.js";
import { CashSparkline }  from "./CashSparkline.js";
import styles from "./PowerView.module.css";

interface PowerViewProps {
  dcId: DatacenterId;
}

export function PowerView({ dcId }: PowerViewProps) {
  const dc            = useSelector(s => selectDatacenter(s, dcId));
  const capacityAgg   = useSelector(selectCapacity);
  const freeCapacity  = useSelector(selectFreeCapacity);
  const opexAgg       = useSelector(selectOpexBreakdown);
  const usageAgg      = useSelector(selectResourceUsage);

  if (!dc) return null;

  const usage     = usageAgg.perDc.find(u => u.dcId === dcId)?.usage;
  const opexEntry = opexAgg.perDc.find(u => u.dcId === dcId);

  // Per-DC capacity derived from aggregate
  const dcCapEntry = capacityAgg.perDc.find(c => c.dcId === dcId);
  const dcCapacity = dcCapEntry?.capacity ?? { vCpu: 0, ramGb: 0, storageTb: 0, gpuFlops: 0 };

  // Per-DC free capacity: scale global free by DC's share
  // Simple approach: DC free = DC total - DC used by contracts (from opex we don't have that)
  // For MVP, show aggregate totals since we have a single-DC view
  const dcFree = {
    vCpu:      Math.max(0, dcCapacity.vCpu      - (capacityAgg.total.vCpu      - freeCapacity.vCpu)),
    ramGb:     Math.max(0, dcCapacity.ramGb     - (capacityAgg.total.ramGb     - freeCapacity.ramGb)),
    storageTb: Math.max(0, dcCapacity.storageTb - (capacityAgg.total.storageTb - freeCapacity.storageTb)),
    gpuFlops:  Math.max(0, dcCapacity.gpuFlops  - (capacityAgg.total.gpuFlops  - freeCapacity.gpuFlops)),
  };

  const EMPTY_USAGE = { powerKw: 0, heatOutputBtuPerHr: 0, bandwidthGbps: 0, slotsUsed: 0 };

  return (
    <div className={styles.view}>
      {/* ── Resource utilization ── */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>RESOURCE UTILIZATION</h3>
        <ResourceBars datacenter={dc} usage={usage ?? EMPTY_USAGE} mode="full" />
      </section>

      {/* ── Capacity breakdown ── */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>RACK CAPACITY</h3>
        <CapacityTiles total={dcCapacity} free={dcFree} />
      </section>

      {/* ── Bottom row: opex + sparkline ── */}
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
