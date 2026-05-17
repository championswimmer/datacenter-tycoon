import { useSelector } from "../../store/storeContext.js";
import {
  selectAllDatacenters,
  selectDatacenterFabricSummary,
  selectDatacenterInfrastructureSummary,
  selectDatacenterUpgradeSummary,
  selectResourceUsage,
  selectRegions,
} from "../../store/selectors.js";
import { LedSegment } from "../../theme/primitives/index.js";
import { navigateToDc, navigate } from "../../router/hashRouter.js";
import type { Route } from "../../router/hashRouter.js";
import styles from "./DatacenterList.module.css";

interface DatacenterListProps {
  currentRoute: Route;
  /** Called when "New Datacenter" is clicked */
  onNewDatacenter?: () => void;
}

export function DatacenterList({ currentRoute, onNewDatacenter }: DatacenterListProps) {
  const datacenters  = useSelector(selectAllDatacenters);
  const usageAggreg  = useSelector(selectResourceUsage);
  const infrastructureSummaries = useSelector((state) =>
    state.datacenters.map((dc) => ({ dcId: dc.id, summary: selectDatacenterInfrastructureSummary(state, dc.id) })),
  );
  const upgradeSummaries = useSelector((state) =>
    state.datacenters.map((dc) => ({ dcId: dc.id, summary: selectDatacenterUpgradeSummary(state, dc.id) })),
  );
  const fabricSummaries = useSelector((state) =>
    state.datacenters.map((dc) => ({ dcId: dc.id, summary: selectDatacenterFabricSummary(state, dc.id) })),
  );
  const regions      = useSelector(selectRegions);

  const selectedDcId = currentRoute.view === "dc" ? currentRoute.dcId : null;

  const openContracts = () => navigate({ view: "contracts" });

  const regionMap = new Map(regions.map(r => [r.id, r]));

  return (
    <div className={styles.rail}>
      <button
        className={styles.contractsBtn}
        onClick={openContracts}
        title="Open contracts market"
        aria-label="Open contracts market"
      >
        📋 CONTRACTS
      </button>

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
          const infrastructure = infrastructureSummaries.find((entry) => entry.dcId === dc.id)?.summary;
          const upgrades = upgradeSummaries.find((entry) => entry.dcId === dc.id)?.summary;
          const fabric = fabricSummaries.find((entry) => entry.dcId === dc.id)?.summary;
          const powerPct   = usage && infrastructure
            ? usage.powerKw / infrastructure.effective.rackPowerCapacityKw
            : 0;
          const slotsTotal = dc.spec.rows * dc.spec.positionsPerRow;
          const slotsUsed  = usage?.slotsUsed ?? 0;
          const isActive   = dc.id === selectedDcId;
          const region     = regionMap.get(dc.regionId);

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

              {region && (
                <div className={styles.dcRegionBlock}>
                  <div className={styles.dcRegionMeta}>{region.code} · {region.city}</div>
                  <div className={styles.dcRegion}>{region.name}</div>
                </div>
              )}

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
                {infrastructure && (
                  <span className={styles.dcStat}>
                    <span className={styles.statKey}>NET</span>
                    <span className={styles.statVal}>{infrastructure.effective.networkType.toUpperCase()}</span>
                  </span>
                )}
              </div>

              {(upgrades || fabric) && (
                <div className={styles.dcFlags}>
                  {fabric && (
                    <>
                      <span className={styles.dcFlag}>
                        {fabric.fabricConnected ? "FABRIC LINKED" : fabric.fabricEligible ? "FABRIC READY" : "FABRIC LOCKED"}
                      </span>
                      <span className={styles.dcFlag}>
                        {fabric.fabricConnected
                          ? `POOL ${fabric.memberDcIds.length} SITES`
                          : fabric.fabricEligible
                            ? `JOIN $${fabric.joinCost.toLocaleString()}`
                            : "FIBER REQUIRED"}
                      </span>
                    </>
                  )}
                  {upgrades && <span className={styles.dcFlag}>UPKEEP ${upgrades.fixedMonthlyUpgradeOpex.toLocaleString()}/MO</span>}
                </div>
              )}

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
