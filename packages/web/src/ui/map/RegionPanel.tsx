import { useCallback } from "react";
import { canBuildInRegion, DATACENTER_CATALOG } from "@datacenter-tycoon/game-logic";
import type { Region, Datacenter } from "@datacenter-tycoon/game-logic";
import { useSelector } from "../../store/storeContext.js";
import { selectCash } from "../../store/selectors.js";
import { ProgressBar } from "../../theme/primitives/index.js";
import { navigateToDc } from "../../router/hashRouter.js";
import styles from "./RegionPanel.module.css";

interface RegionPanelProps {
  region: Region;
  datacenters: Datacenter[];
  onClose: () => void;
  onBuild: () => void;
}

export function RegionPanel({ region, datacenters, onClose, onBuild }: RegionPanelProps) {
  const cash = useSelector(selectCash);
  const regionDcs = datacenters.filter((dc) => dc.regionId === region.id);

  const powerPct = region.totalPowerAvailable > 0
    ? region.powerUsed / region.totalPowerAvailable
    : 0;
  const staffPct = region.totalStaffAvailable > 0
    ? region.staffUsed / region.totalStaffAvailable
    : 0;

  // Check if any datacenter spec can be built in this region
  const canBuildAnything = Object.values(DATACENTER_CATALOG).some((spec) =>
    canBuildInRegion(region, spec, datacenters),
  );

  const handleBuild = useCallback(() => {
    if (!canBuildAnything) return;
    onBuild();
  }, [canBuildAnything, onBuild]);

  return (
    <div className={styles.panel}>
      <div className={styles.panelInner}>
        {/* ── Header ── */}
        <div className={styles.header}>
          <h3 className={styles.name}>{region.name}</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close panel">
            ✕
          </button>
        </div>

        {/* ── Economics ── */}
        <div className={styles.econGrid}>
          <EconTile label="Power Cost" value={`$${region.powerCostPerKwh.toFixed(3)}/kWh`} color="cyan" />
          <EconTile label="Staff Wage" value={`$${region.staffWage.toLocaleString()}/mo`} color="lime" />
          <EconTile label="Tax Rate" value={`${(region.taxRate * 100).toFixed(0)}%`} color="amber" />
        </div>

        {/* ── Availability ── */}
        <div className={styles.availability}>
          <h4 className={styles.sectionTitle}>AVAILABILITY</h4>

          <div className={styles.barGroup}>
            <div className={styles.barHeader}>
              <span className={styles.barLabel}>Grid Power</span>
              <span className={styles.barValue}>
                {region.powerUsed.toLocaleString()} / {region.totalPowerAvailable.toLocaleString()} kW
              </span>
            </div>
            <ProgressBar value={powerPct * 100} max={100} segments={20} color="auto" height={6} />
          </div>

          <div className={styles.barGroup}>
            <div className={styles.barHeader}>
              <span className={styles.barLabel}>Skilled Staff</span>
              <span className={styles.barValue}>
                {region.staffUsed.toLocaleString()} / {region.totalStaffAvailable.toLocaleString()}
              </span>
            </div>
            <ProgressBar value={staffPct * 100} max={100} segments={20} color="auto" height={6} />
          </div>
        </div>

        {/* ── Datacenters in region ── */}
        {regionDcs.length > 0 && (
          <div className={styles.dcList}>
            <h4 className={styles.sectionTitle}>DATACENTERS</h4>
            {regionDcs.map((dc) => (
              <button
                key={dc.id}
                className={styles.dcItem}
                onClick={() => navigateToDc(dc.id)}
              >
                <span className={styles.dcItemName}>{dc.name}</span>
                <span className={styles.dcItemSpec}>{dc.spec.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* ── Build button ── */}
        <div className={styles.footer}>
          {!canBuildAnything && (
            <span className={styles.fullNotice}>Region at capacity — no more builds possible</span>
          )}
          <button
            className={styles.buildBtn}
            onClick={handleBuild}
            disabled={!canBuildAnything}
          >
            BUILD HERE
          </button>
        </div>
      </div>
    </div>
  );
}

function EconTile({ label, value, color }: { label: string; value: string; color: "cyan" | "lime" | "amber" | "red" }) {
  return (
    <div className={styles.econTile}>
      <span className={styles.econLabel}>{label}</span>
      <span className={[styles.econValue, styles[`econ-${color}`]].join(" ")}>{value}</span>
    </div>
  );
}
