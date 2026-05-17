import { useMemo } from "react";
import { useSelector } from "../../store/storeContext.js";
import {
  selectAllDatacenterFabricSummaries,
  selectAllDatacenters,
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
  /** Called when the rail footer should open the regions screen. */
  onOpenRegions?: () => void;
}

export function DatacenterList({ currentRoute, onOpenRegions }: DatacenterListProps) {
  const datacenters  = useSelector(selectAllDatacenters);
  const usageAggreg  = useSelector(selectResourceUsage);
  const infrastructureSummaries = useSelector((state) =>
    state.datacenters.map((dc) => ({ dcId: dc.id, summary: selectDatacenterInfrastructureSummary(state, dc.id) })),
  );
  const upgradeSummaries = useSelector((state) =>
    state.datacenters.map((dc) => ({ dcId: dc.id, summary: selectDatacenterUpgradeSummary(state, dc.id) })),
  );
  const fabricSummaries = useSelector(selectAllDatacenterFabricSummaries);
  const regions      = useSelector(selectRegions);

  const selectedDcId = currentRoute.view === "dc" ? currentRoute.dcId : null;

  const openContracts = () => navigate({ view: "contracts" });
  const openStrategy = () => navigate({ view: "strategy" });

  const usageByDcId = useMemo(
    () => new Map(usageAggreg.perDc.map((entry) => [entry.dcId, entry])),
    [usageAggreg.perDc],
  );
  const infrastructureByDcId = useMemo(
    () => new Map(infrastructureSummaries.map((entry) => [entry.dcId, entry.summary] as const)),
    [infrastructureSummaries],
  );
  const upgradeByDcId = useMemo(
    () => new Map(upgradeSummaries.map((entry) => [entry.dcId, entry.summary] as const)),
    [upgradeSummaries],
  );
  const fabricByDcId = useMemo(
    () => new Map(fabricSummaries.map((entry) => [entry.dcId, entry.summary] as const)),
    [fabricSummaries],
  );
  const regionMap = useMemo(
    () => new Map(regions.map((region) => [region.id, region] as const)),
    [regions],
  );

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

      <button
        className={styles.contractsBtn}
        onClick={openStrategy}
        title="Open strategy page (autopilot & advisors)"
        aria-label="Open strategy page"
      >
        🧠 STRATEGY
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
          const usageEntry = usageByDcId.get(dc.id);
          const usage      = usageEntry?.usage;
          const infrastructure = infrastructureByDcId.get(dc.id);
          const upgrades = upgradeByDcId.get(dc.id);
          const fabric = fabricByDcId.get(dc.id);
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

      {/* ── Regions navigation CTA ── */}
      <button
        className={styles.newDcBtn}
        onClick={onOpenRegions}
        title="Open regions screen"
        aria-label="Open regions screen"
      >
        <span className={styles.newDcPlus}>◎</span>
        <span>REGIONS</span>
      </button>
    </div>
  );
}
