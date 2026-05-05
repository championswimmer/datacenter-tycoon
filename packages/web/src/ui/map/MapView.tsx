import { useState, useCallback } from "react";
import type { RegionId } from "@datacenter-tycoon/game-logic";
import { useSelector } from "../../store/storeContext.js";
import { selectRegions, selectAllDatacenters, selectCash } from "../../store/selectors.js";
import { RegionPanel } from "./RegionPanel.js";
import { NewDatacenterModal } from "../onboarding/NewDatacenterModal.js";
import { WorldMap } from "./WorldMap.js";
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

      {/* ── World map ── */}
      <div className={styles.mapArea}>
        <WorldMap
          regions={regions}
          selectedRegionId={selectedRegionId}
          onSelectRegion={(id) => setSelectedRegionId(id)}
        />
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
