import { useState, useCallback } from "react";
import type { RegionId } from "@datacenter-tycoon/game-logic";
import { useSelector } from "../../store/storeContext.js";
import { selectAllDatacenters, selectAllRegionFabricSummaries, selectCash, selectRegions } from "../../store/selectors.js";
import { RegionPanel } from "./RegionPanel.js";
import { NewDatacenterModal } from "../onboarding/NewDatacenterModal.js";
import { WorldMap } from "./WorldMap.js";
import { RegionTable } from "./RegionTable.js";
import styles from "./MapView.module.css";

type RegionScreenTab = "map" | "table";

export function MapView() {
  const regions = useSelector(selectRegions);
  const datacenters = useSelector(selectAllDatacenters);
  const fabricSummaries = useSelector(selectAllRegionFabricSummaries);
  const cash = useSelector(selectCash);

  const [activeTab, setActiveTab] = useState<RegionScreenTab>("map");
  const [selectedRegionId, setSelectedRegionId] = useState<RegionId | null>(null);
  const [showBuildModal, setShowBuildModal] = useState(false);

  const selectedRegion = selectedRegionId
    ? regions.find((r) => r.id === selectedRegionId) ?? null
    : null;

  const openBuildModal = useCallback(() => setShowBuildModal(true), []);
  const closeBuildModal = useCallback(() => setShowBuildModal(false), []);
  const selectRegion = useCallback((id: RegionId) => setSelectedRegionId(id), []);
  const activeFabricCount = fabricSummaries.filter((summary) => summary.active).length;

  return (
    <div className={styles.mapView}>
      <div className={styles.header}>
        <h2 className={styles.title}>WORLD MAP</h2>
        <span className={styles.subtitle}>
          {regions.length} regions &middot; {datacenters.length} datacenters &middot; {activeFabricCount} active fabrics &middot; ${cash.toLocaleString()} cash
        </span>
      </div>

      <div className={styles.contentGrid}>
        <div className={styles.tabBar} role="tablist" aria-label="Region screen view modes">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "map"}
            aria-controls="region-screen-map-panel"
            id="region-screen-map-tab"
            className={[styles.tabButton, activeTab === "map" ? styles.tabButtonActive : ""].join(" ")}
            onClick={() => setActiveTab("map")}
          >
            Map view
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "table"}
            aria-controls="region-screen-table-panel"
            id="region-screen-table-tab"
            className={[styles.tabButton, activeTab === "table" ? styles.tabButtonActive : ""].join(" ")}
            onClick={() => setActiveTab("table")}
          >
            Table view
          </button>
        </div>

        {activeTab === "map" ? (
          <section
            className={styles.surface}
            role="tabpanel"
            id="region-screen-map-panel"
            aria-labelledby="region-screen-map-tab"
          >
            <div className={styles.sectionHeader}>
              <div className={styles.sectionCopyBlock}>
                <h3 className={styles.sectionTitle}>GLOBAL FOOTPRINT</h3>
                <p className={styles.sectionCopy}>
                  Scan the world view for geography, then drill into any region to inspect build headroom.
                </p>
              </div>
              <span className={styles.sectionMeta}>
                {selectedRegion ? `${selectedRegion.code} · ${selectedRegion.city}` : "Select any marker to inspect a region"}
              </span>
            </div>

            <div className={[styles.mapBody, selectedRegion ? styles.mapBodyWithPanel : ""].join(" ")}>
              <div className={styles.mapStage}>
                <WorldMap
                  regions={regions}
                  selectedRegionId={selectedRegionId}
                  onSelectRegion={selectRegion}
                />
              </div>

              {selectedRegion && (
                <div className={styles.panelStage}>
                  <RegionPanel
                    region={selectedRegion}
                    datacenters={datacenters}
                    onClose={() => setSelectedRegionId(null)}
                    onBuild={openBuildModal}
                  />
                </div>
              )}
            </div>
          </section>
        ) : (
          <section
            className={styles.surface}
            role="tabpanel"
            id="region-screen-table-panel"
            aria-labelledby="region-screen-table-tab"
          >
            <div className={styles.sectionHeader}>
              <div className={styles.sectionCopyBlock}>
                <h3 className={styles.sectionTitle}>REGION ECONOMICS</h3>
                <p className={styles.sectionCopy}>
                  Sort by cost, power, staff, or tax to compare expansion targets before you commit capex.
                </p>
              </div>
              <span className={styles.sectionMeta}>
                {selectedRegion ? `${selectedRegion.code} · ${selectedRegion.city}` : "Clickable rows stay synchronized with the map"}
              </span>
            </div>

            <div className={[styles.tableBody, selectedRegion ? styles.tableBodyWithPanel : ""].join(" ")}>
              <div className={styles.tableStage}>
                <RegionTable
                  regions={regions}
                  selectedRegionId={selectedRegionId}
                  onSelectRegion={selectRegion}
                />
              </div>

              {selectedRegion && (
                <div className={styles.panelStage}>
                  <RegionPanel
                    region={selectedRegion}
                    datacenters={datacenters}
                    onClose={() => setSelectedRegionId(null)}
                    onBuild={openBuildModal}
                  />
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {showBuildModal && selectedRegion && (
        <NewDatacenterModal
          onClose={closeBuildModal}
          regionId={selectedRegion.id as RegionId}
        />
      )}
    </div>
  );
}
