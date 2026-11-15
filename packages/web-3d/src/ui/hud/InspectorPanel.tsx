import {
  canPlaceRack,
  RACK_CATALOG,
  type DatacenterId,
  type DatacenterResourceUsage,
  type RackPlacementId,
  type RegionId,
} from "@datacenter-tycoon/game-logic";
import {
  CapacityTiles,
  nextRackPlacementId,
  playSound,
  ResourceBars,
  selectAllDatacenters,
  selectAudioEnabled,
  selectCash,
  selectDatacenter,
  selectDatacenterCapacitySummary,
  selectDatacenterInfrastructureSummary,
  selectDatacenterMaintenanceStaffingView,
  selectDatacenterMaintenanceView,
  selectDatacenterRackActivityViews,
  selectDatacenterRackMaintenanceViews,
  selectDatacenterResourceUsage,
  selectRegionById,
  useGameDispatch,
  useSelector,
} from "@datacenter-tycoon/web";
import type { BuildTool, SelectionTarget } from "../../state/viewportState.js";
import styles from "./InspectorPanel.module.css";

const EMPTY_USAGE: DatacenterResourceUsage = {
  powerKw: 0,
  heatOutputBtuPerHr: 0,
  bandwidthGbps: 0,
  slotsUsed: 0,
};

const EMPTY_CAP = { vCpu: 0, ramGb: 0, storageTb: 0, gpuFlops: 0 };

export interface InspectorPanelProps {
  selection: SelectionTarget;
  activeRegionId: RegionId | null;
  activeDcId: DatacenterId | null;
  buildTool: BuildTool;
  onEnterFacility: (dcId: DatacenterId) => void;
  onEnterCity: () => void;
  onOpenRackPicker: (dcId: DatacenterId, row: number, position: number) => void;
  onOpenMoveRackModal: (dcId: DatacenterId, placementId: RackPlacementId) => void;
  onOpenUpgrades: () => void;
  onOpenBuildDcModal: () => void;
  onClearSelection: () => void;
}

export function InspectorPanel({
  selection,
  activeRegionId,
  activeDcId,
  buildTool,
  onEnterFacility,
  onEnterCity,
  onOpenRackPicker,
  onOpenMoveRackModal,
  onOpenUpgrades,
  onOpenBuildDcModal,
  onClearSelection,
}: InspectorPanelProps) {
  const dispatch = useGameDispatch();
  const cash = useSelector(selectCash);
  const audioEnabled = useSelector(selectAudioEnabled);
  const allDatacenters = useSelector(selectAllDatacenters);

  const inspectedDcId: DatacenterId | null =
    selection.kind === "datacenter" || selection.kind === "rack" || selection.kind === "slot"
      ? selection.dcId
      : activeDcId;

  const datacenter = useSelector((state) =>
    inspectedDcId ? selectDatacenter(state, inspectedDcId) : undefined,
  );
  const infrastructure = useSelector((state) =>
    inspectedDcId ? selectDatacenterInfrastructureSummary(state, inspectedDcId) : undefined,
  );
  const capacitySummary = useSelector((state) =>
    inspectedDcId ? selectDatacenterCapacitySummary(state, inspectedDcId) : undefined,
  );
  const usage = useSelector((state) =>
    inspectedDcId ? selectDatacenterResourceUsage(state, inspectedDcId) ?? EMPTY_USAGE : EMPTY_USAGE,
  );
  const maintenance = useSelector((state) =>
    inspectedDcId ? selectDatacenterMaintenanceView(state, inspectedDcId) : undefined,
  );
  const maintenanceStaffing = useSelector((state) =>
    inspectedDcId ? selectDatacenterMaintenanceStaffingView(state, inspectedDcId) : undefined,
  );
  const rackActivities = useSelector((state) =>
    inspectedDcId ? selectDatacenterRackActivityViews(state, inspectedDcId) : [],
  );
  const rackMaintenance = useSelector((state) =>
    inspectedDcId ? selectDatacenterRackMaintenanceViews(state, inspectedDcId) : [],
  );
  const region = useSelector((state) =>
    activeRegionId ? selectRegionById(state, activeRegionId) : undefined,
  );

  // Selected Rack detail
  if (selection.kind === "rack" && datacenter) {
    const placement = datacenter.placements.find((p) => p.id === selection.placementId);
    const spec = placement ? RACK_CATALOG[placement.specId] : undefined;
    const activity = placement
      ? rackActivities.find((a) => a.placementId === placement.id)
      : undefined;
    const maint = placement
      ? rackMaintenance.find((m) => m.placementId === placement.id)
      : undefined;

    if (placement && spec) {
      return (
        <aside className={styles.panel} aria-label="3D Object Inspector">
          <div className={styles.header}>
            <div>
              <div className={styles.kicker}>RACK · R{placement.row + 1} · B{placement.position + 1}</div>
              <h3 className={styles.title}>{spec.name}</h3>
            </div>
            <button type="button" className={styles.closeBtn} onClick={onClearSelection} aria-label="Close Inspector">
              ✕
            </button>
          </div>

          <div className={styles.kvGrid}>
            <div><span>KIND</span><strong>{spec.kind.toUpperCase()} T{spec.tier}</strong></div>
            <div><span>STATUS</span><strong>{(activity?.status ?? placement.health).toUpperCase()}</strong></div>
            <div><span>POWER</span><strong>{(activity?.billedPowerKw ?? spec.powerDrawKw).toFixed(1)} kW</strong></div>
            <div><span>AGE</span><strong>{maint ? `${maint.ageMonths} mo` : "New"}</strong></div>
          </div>

          {maint && maint.status === "repairing" && (
            <div className={styles.alertBox}>
              Repairing · {maint.repairCompletionPercent}% ({maint.repairEtaDays}d ETA)
            </div>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => onOpenMoveRackModal(datacenter.id, placement.id)}
            >
              ⇄ Move Rack
            </button>
            <button
              type="button"
              className={styles.dangerBtn}
              onClick={() => {
                dispatch({ type: "RemoveRack", dcId: datacenter.id, placementId: placement.id });
                playSound("click", !audioEnabled);
                onClearSelection();
              }}
            >
              🗑 Decommission Rack
            </button>
          </div>
        </aside>
      );
    }
  }

  // Selected Empty Floor Slot
  if (selection.kind === "slot" && datacenter) {
    const brushSpec = buildTool.mode === "place_rack" ? RACK_CATALOG[buildTool.specId] : undefined;
    const check = brushSpec
      ? canPlaceRack(datacenter, brushSpec, { row: selection.row, position: selection.position })
      : null;

    return (
      <aside className={styles.panel} aria-label="3D Object Inspector">
        <div className={styles.header}>
          <div>
            <div className={styles.kicker}>FLOOR BAY · R{selection.row + 1} · B{selection.position + 1}</div>
            <h3 className={styles.title}>Empty Mounting Bay</h3>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClearSelection} aria-label="Close Inspector">
            ✕
          </button>
        </div>

        <p className={styles.hint}>
          {datacenter.name} · {selection.row % 2 === 0 ? "Cold Aisle Intake" : "Hot Aisle Exhaust"}
        </p>

        {brushSpec && (
          <div className={styles.brushBox}>
            <div>Brush: <strong>{brushSpec.name}</strong> (${brushSpec.capexCost.toLocaleString()})</div>
            {check && !check.ok && (
              <div className={styles.alertBox}>Blocked: {check.reason}</div>
            )}
            <button
              type="button"
              disabled={!check?.ok || cash < brushSpec.capexCost}
              className={styles.primaryBtn}
              onClick={() => {
                if (!check?.ok || cash < brushSpec.capexCost) {
                  playSound("error", !audioEnabled);
                  return;
                }
                dispatch({
                  type: "PlaceRack",
                  dcId: datacenter.id,
                  specId: brushSpec.id,
                  row: selection.row,
                  position: selection.position,
                  placementId: nextRackPlacementId(),
                });
                playSound("success", !audioEnabled);
              }}
            >
              Install {brushSpec.id} Here
            </button>
          </div>
        )}

        <button
          type="button"
          className={styles.secondaryBtn}
          onClick={() => onOpenRackPicker(datacenter.id, selection.row, selection.position)}
        >
          Browse Rack Catalog…
        </button>
      </aside>
    );
  }

  // Selected Datacenter Overview
  if (datacenter) {
    return (
      <aside className={styles.panel} aria-label="3D Object Inspector">
        <div className={styles.header}>
          <div>
            <div className={styles.kicker}>{datacenter.spec.name.toUpperCase()}</div>
            <h3 className={styles.title}>{datacenter.name}</h3>
          </div>
          {selection.kind !== "none" && (
            <button type="button" className={styles.closeBtn} onClick={onClearSelection} aria-label="Close Inspector">
              ✕
            </button>
          )}
        </div>

        <ResourceBars
          datacenter={datacenter}
          usage={usage}
          infrastructure={infrastructure}
          mode="compact"
        />

        {capacitySummary && (
          <CapacityTiles
            total={capacitySummary.usable}
            free={capacitySummary.available}
            modeLabel="FACILITY CAPACITY"
          />
        )}

        {maintenance && maintenanceStaffing && (
          <div className={styles.staffRow}>
            <span>Tech Staff: <strong>{maintenance.maintenanceStaff}</strong></span>
            <div className={styles.staffControls}>
              <button
                type="button"
                className={styles.miniBtn}
                disabled={!maintenanceStaffing.canDecrease}
                onClick={() => dispatch({
                  type: "SetMaintenanceStaff",
                  dcId: datacenter.id,
                  maintenanceStaff: maintenanceStaffing.currentStaff - 1,
                })}
              >
                −
              </button>
              <button
                type="button"
                className={styles.miniBtn}
                disabled={!maintenanceStaffing.canIncrease}
                onClick={() => dispatch({
                  type: "SetMaintenanceStaff",
                  dcId: datacenter.id,
                  maintenanceStaff: maintenanceStaffing.currentStaff + 1,
                })}
              >
                +
              </button>
            </div>
          </div>
        )}

        <div className={styles.actions}>
          {activeDcId === datacenter.id ? (
            <button type="button" className={styles.secondaryBtn} onClick={onEnterCity}>
              🏙 Return to City Skyline
            </button>
          ) : (
            <button type="button" className={styles.primaryBtn} onClick={() => onEnterFacility(datacenter.id)}>
              🖥 Enter 3D Cutaway Floor
            </button>
          )}
          <button type="button" className={styles.secondaryBtn} onClick={onOpenUpgrades}>
            ⚡ Power & Infrastructure Upgrades
          </button>
        </div>
      </aside>
    );
  }

  // Fallback: Regional / Landmark Overview
  if (region) {
    const regionDcs = allDatacenters.filter((dc) => dc.regionId === region.id);
    return (
      <aside className={styles.panel} aria-label="3D Object Inspector">
        <div className={styles.header}>
          <div>
            <div className={styles.kicker}>REGION DISTRICT · {region.code}</div>
            <h3 className={styles.title}>{region.city}</h3>
          </div>
        </div>
        <div className={styles.kvGrid}>
          <div><span>DATACENTERS</span><strong>{regionDcs.length}</strong></div>
          <div><span>GRID POWER</span><strong>{region.powerUsed}/{region.totalPowerAvailable} kW</strong></div>
          <div><span>STAFF POOL</span><strong>{region.staffUsed}/{region.totalStaffAvailable}</strong></div>
          <div><span>RATE</span><strong>${region.powerCostPerKwh.toFixed(3)}/kWh</strong></div>
        </div>
        <CapacityTiles total={EMPTY_CAP} free={EMPTY_CAP} modeLabel="SELECT A CAMPUS OR ZONE" />
        <button type="button" className={styles.primaryBtn} onClick={onOpenBuildDcModal}>
          🏗 Build Facility in {region.city}
        </button>
      </aside>
    );
  }

  return null;
}
