import { useSelector } from "../../store/storeContext.js";
import { selectAllDatacenters, selectResourceUsage } from "../../store/selectors.js";
import { LedSegment } from "../../theme/primitives/index.js";
import { navigateToDc } from "../../router/hashRouter.js";
import type { Route } from "../../router/hashRouter.js";
import styles from "./DatacenterList.module.css";

interface DatacenterListProps {
  currentRoute: Route;
  /** Called when "New Datacenter" is clicked — Phase 5 will wire the modal */
  onNewDatacenter?: () => void;
}

export function DatacenterList({ currentRoute, onNewDatacenter }: DatacenterListProps) {
  const datacenters  = useSelector(selectAllDatacenters);
  const usageAggreg  = useSelector(selectResourceUsage);

  const selectedDcId = currentRoute.view === "dc" ? currentRoute.dcId : null;

  return (
    <div className={styles.rail}>
      <div className={styles.header}>
        <span className={styles.headerLabel}>DATACENTERS</span>
        <span className={styles.count}>{datacenters.length}</span>
      </div>

      <div className={styles.list}>
        {datacenters.length === 0 && (
          <div className={styles.empty}>No facilities online</div>
        )}

        {datacenters.map(dc => {
          const usageEntry = usageAggreg.perDc.find(u => u.dcId === dc.id);
          const usage      = usageEntry?.usage;
          const powerPct   = usage
            ? usage.powerKw / dc.spec.powerCapacityKw
            : 0;
          const slotsTotal = dc.spec.rows * dc.spec.positionsPerRow;
          const slotsUsed  = usage?.slotsUsed ?? 0;
          const isActive   = dc.id === selectedDcId;

          const ledColor = powerPct > 0.9 ? "red" : powerPct > 0.7 ? "amber" : "lime";

          return (
            <button
              key={dc.id}
              className={[styles.dcCard, isActive ? styles.dcActive : ""].join(" ")}
              onClick={() => navigateToDc(dc.id)}
              title={dc.name}
            >
              <div className={styles.dcTop}>
                <LedSegment color={ledColor} size={8} />
                <span className={styles.dcName}>{dc.name}</span>
              </div>

              <div className={styles.dcStats}>
                <span className={styles.dcStat}>
                  <span className={styles.statKey}>SLOTS</span>
                  <span className={styles.statVal}>{slotsUsed}/{slotsTotal}</span>
                </span>
                <span className={styles.dcStat}>
                  <span className={styles.statKey}>PWR</span>
                  <span className={[
                    styles.statVal,
                    powerPct > 0.9 ? styles.statRed : powerPct > 0.7 ? styles.statAmber : "",
                  ].join(" ")}>
                    {powerPct > 0 ? `${Math.round(powerPct * 100)}%` : "idle"}
                  </span>
                </span>
              </div>

              {/* Slim power utilization bar */}
              <div className={styles.powerBar}>
                <div
                  className={[
                    styles.powerFill,
                    powerPct > 0.9 ? styles.fillRed : powerPct > 0.7 ? styles.fillAmber : styles.fillCyan,
                  ].join(" ")}
                  style={{ width: `${Math.min(powerPct * 100, 100)}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* ── New datacenter CTA ── */}
      <button
        className={styles.newDcBtn}
        onClick={onNewDatacenter}
        title="Build a new datacenter"
      >
        <span className={styles.newDcPlus}>+</span>
        <span>NEW DATACENTER</span>
      </button>
    </div>
  );
}
