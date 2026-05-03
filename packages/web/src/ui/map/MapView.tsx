import { useState, useCallback } from "react";
import { canBuildInRegion } from "@datacenter-tycoon/game-logic";
import type { Region, RegionId } from "@datacenter-tycoon/game-logic";
import { useSelector } from "../../store/storeContext.js";
import { selectRegions, selectAllDatacenters, selectCash } from "../../store/selectors.js";
import { ProgressBar } from "../../theme/primitives/index.js";
import { RegionPanel } from "./RegionPanel.js";
import { NewDatacenterModal } from "../onboarding/NewDatacenterModal.js";
import styles from "./MapView.module.css";

export function MapView() {
  const regions = useSelector(selectRegions);
  const datacenters = useSelector(selectAllDatacenters);
  const cash = useSelector(selectCash);

  const [selectedRegionId, setSelectedRegionId] = useState<RegionId | null>(null);
  const [showBuildModal, setShowBuildModal] = useState(false);

  const selectedRegion = selectedRegionId
    ? regions.find((r) => r.id === selectedRegionId) ?? null
    : null;

  const openBuildModal = useCallback(() => setShowBuildModal(true), []);
  const closeBuildModal = useCallback(() => setShowBuildModal(false), []);

  return (
    <div className={styles.mapView}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <h2 className={styles.title}>WORLD MAP</h2>
        <span className={styles.subtitle}>
          {regions.length} regions &middot; {datacenters.length} datacenters
        </span>
      </div>

      {/* ── Region grid ── */}
      <div className={styles.regionGrid}>
        {regions.map((region) => (
          <RegionCard
            key={region.id}
            region={region}
            datacenters={datacenters}
            cash={cash}
            selected={region.id === selectedRegionId}
            onSelect={() => setSelectedRegionId(region.id as RegionId)}
          />
        ))}
      </div>

      {/* ── Region detail panel ── */}
      {selectedRegion && (
        <RegionPanel
          region={selectedRegion}
          datacenters={datacenters}
          onClose={() => setSelectedRegionId(null)}
          onBuild={openBuildModal}
        />
      )}

      {/* ── Build modal ── */}
      {showBuildModal && selectedRegion && (
        <NewDatacenterModal
          onClose={closeBuildModal}
          regionId={selectedRegion.id as RegionId}
        />
      )}
    </div>
  );
}

// ── Region Card ───────────────────────────────────────────────────────────────

interface RegionCardProps {
  region: Region;
  datacenters: import("@datacenter-tycoon/game-logic").Datacenter[];
  cash: number;
  selected: boolean;
  onSelect: () => void;
}

function RegionCard({ region, datacenters, cash, selected, onSelect }: RegionCardProps) {
  const dcCount = datacenters.filter((dc) => dc.regionId === region.id).length;
  const powerPct = region.totalPowerAvailable > 0
    ? region.powerUsed / region.totalPowerAvailable
    : 0;
  const staffPct = region.totalStaffAvailable > 0
    ? region.staffUsed / region.totalStaffAvailable
    : 0;

  // Color-code by power cost: cheap = lime, moderate = cyan, expensive = amber, very expensive = red
  const costColor = getCostColor(region.powerCostPerKwh);

  return (
    <button
      className={[
        styles.card,
        selected ? styles.cardSelected : "",
      ].filter(Boolean).join(" ")}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <div className={styles.cardHeader}>
        <span className={[styles.costIndicator, styles[`cost-${costColor}`]].join(" ")} />
        <span className={styles.cardName}>{region.name}</span>
        {dcCount > 0 && (
          <span className={styles.dcBadge}>{dcCount} DC</span>
        )}
      </div>

      <div className={styles.cardStats}>
        <StatRow label="POWER" value={`$${region.powerCostPerKwh.toFixed(2)}/kWh`} />
        <StatRow label="WAGE" value={`$${(region.staffWage / 1000).toFixed(1)}K/mo`} />
        <StatRow label="TAX" value={`${(region.taxRate * 100).toFixed(0)}%`} />
      </div>

      <div className={styles.bars}>
        <BarRow label="PWR" pct={powerPct} />
        <BarRow label="STAFF" pct={staffPct} />
      </div>
    </button>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.statRow}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
    </div>
  );
}

function BarRow({ label, pct }: { label: string; pct: number }) {
  return (
    <div className={styles.barRow}>
      <span className={styles.barLabel}>{label}</span>
      <ProgressBar value={pct * 100} max={100} segments={12} color="auto" height={4} />
      <span className={styles.barPct}>{Math.round(pct * 100)}%</span>
    </div>
  );
}

function getCostColor(costPerKwh: number): string {
  if (costPerKwh < 0.08) return "lime";
  if (costPerKwh < 0.12) return "cyan";
  if (costPerKwh < 0.18) return "amber";
  return "red";
}
