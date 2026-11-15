import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  canPlaceRack,
  RACK_CATALOG,
  type DatacenterId,
  type DatacenterResourceUsage,
  type PlacementFailureReason,
  type RackPlacement,
  type RackPlacementId,
  type RackSpecId,
  type RegionId,
} from "@datacenter-tycoon/game-logic";
import {
  nextRackPlacementId,
  playSound,
  selectActiveContractViews,
  selectAllDatacenters,
  selectAllDatacenterFabricSummaries,
  selectAudioEnabled,
  selectCash,
  selectDatacenter,
  selectDatacenterInfrastructureSummary,
  selectDatacenterRackActivityViews,
  selectDatacenterRackMaintenanceViews,
  selectDatacenterResourceUsage,
  selectRegionById,
  selectRegionFabricSummary,
  selectRegions,
  useFullGameState,
  useGameDispatch,
  useSelector,
} from "@datacenter-tycoon/web";
import {
  panCameraByScreenDelta,
  zoomCameraAtPoint,
  type IsoCameraState,
} from "../../engine/camera.js";
import {
  renderCityScene,
  type CityDatacenterSummary,
  type CityHitTarget,
} from "../../engine/cityScene.js";
import {
  renderFloorScene,
  type FloorHitTarget,
} from "../../engine/floorScene.js";
import { pickTopHitTarget } from "../../engine/isoMath.js";
import type { InfoOverlayMode } from "../../engine/rackModels3d.js";
import type {
  BuildTool,
  CameraViewMode,
  SelectionTarget,
} from "../../state/viewportState.js";
import styles from "./IsoViewportCanvas.module.css";

const EMPTY_USAGE: DatacenterResourceUsage = {
  powerKw: 0,
  heatOutputBtuPerHr: 0,
  bandwidthGbps: 0,
  slotsUsed: 0,
};

const MAX_DISTRICT_PLOTS = 6;

const LANDMARK_BUTTONS = [
  { id: "power_substation", label: "Regional Power Substation" },
  { id: "fiber_exchange", label: "Regional Fiber Exchange Hub" },
  { id: "workforce_campus", label: "Workforce & Tech Campus" },
] as const;

export interface IsoViewportCanvasProps {
  viewMode: CameraViewMode;
  activeRegionId: RegionId | null;
  activeDcId: DatacenterId | null;
  camera: IsoCameraState;
  onCameraChange: Dispatch<SetStateAction<IsoCameraState>>;
  overlayMode: InfoOverlayMode;
  buildTool: BuildTool;
  selection: SelectionTarget;
  onSelect: (target: SelectionTarget) => void;
  onEnterFacility: (dcId: DatacenterId, regionId?: RegionId) => void;
  onOpenBuildDcModal: (regionId: RegionId) => void;
  onActionFeedback?: (message: string) => void;
  /** Simulation speed (0 = paused). Scene animations only advance while speed > 0. */
  speed?: number;
}

export function IsoViewportCanvas({
  viewMode,
  activeRegionId,
  activeDcId,
  camera,
  onCameraChange,
  overlayMode,
  buildTool,
  selection,
  onSelect,
  onEnterFacility,
  onOpenBuildDcModal,
  onActionFeedback,
  speed = 1,
}: IsoViewportCanvasProps) {
  const dispatch = useGameDispatch();
  const fullState = useFullGameState();
  const cash = useSelector(selectCash);
  const audioEnabled = useSelector(selectAudioEnabled);
  const regions = useSelector(selectRegions);
  const allDatacenters = useSelector(selectAllDatacenters);
  const activeContracts = useSelector(selectActiveContractViews);
  const allFabricSummaries = useSelector(selectAllDatacenterFabricSummaries);

  const effectiveRegion =
    useSelector((state) => (activeRegionId ? selectRegionById(state, activeRegionId) : undefined)) ??
    regions[0];

  const regionFabric = useSelector((state) =>
    effectiveRegion ? selectRegionFabricSummary(state, effectiveRegion.id) : undefined,
  );

  const facilityDc = useSelector((state) =>
    activeDcId ? selectDatacenter(state, activeDcId) : undefined,
  );
  const facilityInfrastructure = useSelector((state) =>
    facilityDc ? selectDatacenterInfrastructureSummary(state, facilityDc.id) : undefined,
  );
  const facilityUsage = useSelector((state) =>
    facilityDc ? selectDatacenterResourceUsage(state, facilityDc.id) ?? EMPTY_USAGE : EMPTY_USAGE,
  );
  const facilityActivities = useSelector((state) =>
    facilityDc ? selectDatacenterRackActivityViews(state, facilityDc.id) : [],
  );
  const facilityMaintenance = useSelector((state) =>
    facilityDc ? selectDatacenterRackMaintenanceViews(state, facilityDc.id) : [],
  );

  // Build summaries per datacenter in the active city region using canonical web selectors
  const cityDcSummaries = useMemo<CityDatacenterSummary[]>(() => {
    if (!effectiveRegion) return [];
    const regionDcs = allDatacenters.filter((dc) => dc.regionId === effectiveRegion.id);
    const fabricMap = new Map(allFabricSummaries.map((f) => [f.dcId, f.summary]));

    return regionDcs.map((datacenter) => {
      const infrastructure = selectDatacenterInfrastructureSummary(fullState, datacenter.id)!;
      const usage = selectDatacenterResourceUsage(fullState, datacenter.id) ?? EMPTY_USAGE;
      const activeContractCount = activeContracts.filter(
        (view) => view.contract.assignedDcId === datacenter.id,
      ).length;
      const repairingRackCount = datacenter.placements.filter(
        (p) => p.health === "repairing",
      ).length;
      const fabric = fabricMap.get(datacenter.id);
      return {
        datacenter,
        infrastructure,
        usage,
        activeContractCount,
        repairingRackCount,
        fabricConnected: fabric?.fabricConnected ?? false,
      };
    });
  }, [effectiveRegion, allDatacenters, allFabricSummaries, fullState, activeContracts]);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 1280, height: 720 });
  const cityHitsRef = useRef<CityHitTarget[]>([]);
  const floorHitsRef = useRef<FloorHitTarget[]>([]);
  const hoveredCityRef = useRef<CityHitTarget | null>(null);
  const hoveredFloorRef = useRef<FloorHitTarget | null>(null);
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    moved: boolean;
  } | null>(null);

  const canPlaceAtSlot = useCallback(
    (row: number, position: number, specId: RackSpecId): { ok: boolean; reason?: PlacementFailureReason } => {
      if (!facilityDc) return { ok: false };
      const spec = RACK_CATALOG[specId];
      if (!spec) return { ok: false };
      return canPlaceRack(facilityDc, spec, { row, position });
    },
    [facilityDc],
  );

  // Shared slot interaction (used by both Canvas click and Accessible Overlay)
  const handleSlotActivate = useCallback(
    (row: number, position: number) => {
      if (!facilityDc) return;

      if (buildTool.mode === "place_rack") {
        const spec = RACK_CATALOG[buildTool.specId];
        if (!spec) return;
        if (cash < spec.capexCost) {
          playSound("error", !audioEnabled);
          onActionFeedback?.(`Insufficient funds: need $${spec.capexCost.toLocaleString()} for ${spec.id}`);
          onSelect({ kind: "slot", dcId: facilityDc.id, row, position });
          return;
        }
        const check = canPlaceRack(facilityDc, spec, { row, position });
        if (!check.ok) {
          playSound("error", !audioEnabled);
          onActionFeedback?.(`Placement blocked (${check.reason})`);
          onSelect({ kind: "slot", dcId: facilityDc.id, row, position });
          return;
        }

        const placementId = nextRackPlacementId();
        dispatch({
          type: "PlaceRack",
          dcId: facilityDc.id,
          specId: spec.id,
          row,
          position,
          placementId,
        });
        playSound("success", !audioEnabled);
        onSelect({ kind: "rack", dcId: facilityDc.id, placementId, row, position });
        return;
      }

      onSelect({ kind: "slot", dcId: facilityDc.id, row, position });
    },
    [
      facilityDc,
      buildTool,
      cash,
      audioEnabled,
      dispatch,
      onSelect,
      onActionFeedback,
    ],
  );

  // Shared rack interaction (used by both Canvas click and Accessible Overlay)
  const handleRackActivate = useCallback(
    (placement: RackPlacement) => {
      if (!facilityDc) return;
      if (buildTool.mode === "bulldozer") {
        dispatch({
          type: "RemoveRack",
          dcId: facilityDc.id,
          placementId: placement.id,
        });
        playSound("click", !audioEnabled);
        onSelect({ kind: "datacenter", dcId: facilityDc.id });
        return;
      }
      onSelect({
        kind: "rack",
        dcId: facilityDc.id,
        placementId: placement.id,
        row: placement.row,
        position: placement.position,
      });
    },
    [facilityDc, buildTool.mode, dispatch, audioEnabled, onSelect],
  );

  // Observe container resize for crisp HiDPI canvas sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setViewportSize({ width: rect.width, height: rect.height });
      }
    };
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const speedRef = useRef(speed);
  speedRef.current = speed;
  const animClockRef = useRef({ simMs: 0, lastMs: 0 });

  // Main render loop (also renders immediately on state/camera/tool change)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = typeof window !== "undefined" ? Math.min(2, window.devicePixelRatio || 1) : 1;
    const vw = viewportSize.width;
    const vh = viewportSize.height;
    if (canvas.width !== Math.round(vw * dpr) || canvas.height !== Math.round(vh * dpr)) {
      canvas.width = Math.round(vw * dpr);
      canvas.height = Math.round(vh * dpr);
    }

    let rafId = 0;
    const startMs = performance.now();

    // Animation clock: persists across effect re-runs and only advances while the game is running,
    // scaled by sim speed, so traffic/pulses/blinks freeze on pause instead of drifting on wall-clock.
    const clock = animClockRef.current;
    clock.lastMs = startMs;

    const drawFrame = (nowMs: number) => {
      const speedFactor = speedRef.current;
      if (speedFactor > 0) clock.simMs += Math.max(0, nowMs - clock.lastMs) * speedFactor;
      clock.lastMs = nowMs;
      const timeSec = clock.simMs * 0.001;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (viewMode === "facility" && facilityDc && facilityInfrastructure) {
        const selectedPlacementId =
          selection.kind === "rack" && selection.dcId === facilityDc.id
            ? selection.placementId
            : null;
        const selectedSlot =
          selection.kind === "slot" && selection.dcId === facilityDc.id
            ? { row: selection.row, position: selection.position }
            : null;

        floorHitsRef.current = renderFloorScene(ctx, vw, vh, {
          datacenter: facilityDc,
          infrastructure: facilityInfrastructure,
          usage: facilityUsage,
          rackActivities: facilityActivities,
          rackMaintenance: facilityMaintenance,
          camera,
          overlayMode,
          activeRackSpecId: buildTool.mode === "place_rack" ? buildTool.specId : null,
          selectedPlacementId,
          selectedSlot,
          hoveredTarget: hoveredFloorRef.current,
          canPlaceAtSlot,
          timeSec,
        });
      } else if (effectiveRegion) {
        const selectedDcId =
          selection.kind === "datacenter" ? selection.dcId : activeDcId;
        cityHitsRef.current = renderCityScene(ctx, vw, vh, {
          region: effectiveRegion,
          datacenters: cityDcSummaries,
          regionFabric,
          camera,
          overlayMode,
          selectedDcId,
          hoveredTarget: hoveredCityRef.current,
          buildDcToolActive: buildTool.mode === "build_dc",
          timeSec,
        });
      }
    };

    drawFrame(startMs);
    const loop = (ts: number) => {
      drawFrame(ts);
      rafId = window.requestAnimationFrame(loop);
    };
    rafId = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [
    viewportSize,
    viewMode,
    effectiveRegion,
    cityDcSummaries,
    regionFabric,
    facilityDc,
    facilityInfrastructure,
    facilityUsage,
    facilityActivities,
    facilityMaintenance,
    camera,
    overlayMode,
    buildTool,
    selection,
    activeDcId,
    canPlaceAtSlot,
  ]);

  const activeGridDims = useMemo(() => {
    if (viewMode === "facility" && facilityDc) {
      return { cols: facilityDc.spec.positionsPerRow, rows: facilityDc.spec.rows };
    }
    return { cols: 12, rows: 12 };
  }, [viewMode, facilityDc]);

  const canvasCoords = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return {
      x: clientX - (rect?.left ?? 0),
      y: clientY - (rect?.top ?? 0),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag?.active) {
      const dx = e.clientX - drag.lastX;
      const dy = e.clientY - drag.lastY;
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 5) {
        drag.moved = true;
      }
      if (drag.moved) {
        onCameraChange((prev) =>
          panCameraByScreenDelta(
            prev,
            dx,
            dy,
            viewportSize.width,
            viewportSize.height,
            activeGridDims.cols,
            activeGridDims.rows,
          ),
        );
      }
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      return;
    }

    const pt = canvasCoords(e.clientX, e.clientY);
    if (viewMode === "facility") {
      hoveredFloorRef.current = pickTopHitTarget(pt.x, pt.y, floorHitsRef.current);
    } else {
      hoveredCityRef.current = pickTopHitTarget(pt.x, pt.y, cityHitsRef.current);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.moved) return;

    const pt = canvasCoords(e.clientX, e.clientY);
    if (viewMode === "facility" && facilityDc) {
      const hit = pickTopHitTarget(pt.x, pt.y, floorHitsRef.current);
      if (!hit) return;
      if (hit.kind === "rack") {
        const placement = facilityDc.placements.find((p) => p.id === hit.placementId);
        if (placement) handleRackActivate(placement);
      } else if (hit.kind === "slot") {
        handleSlotActivate(hit.row, hit.position);
      } else {
        onSelect({ kind: "datacenter", dcId: facilityDc.id });
      }
    } else if (effectiveRegion) {
      const hit = pickTopHitTarget(pt.x, pt.y, cityHitsRef.current);
      if (!hit) return;
      if (hit.kind === "datacenter") {
        onSelect({ kind: "datacenter", dcId: hit.dcId });
      } else if (hit.kind === "vacant_lot") {
        onOpenBuildDcModal(hit.regionId);
      } else {
        onSelect({ kind: "landmark", landmarkId: hit.landmarkId, label: hit.label });
      }
    }
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (viewMode !== "city") return;
    const pt = canvasCoords(e.clientX, e.clientY);
    const hit = pickTopHitTarget(pt.x, pt.y, cityHitsRef.current);
    if (hit?.kind === "datacenter") {
      onEnterFacility(hit.dcId, hit.regionId);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const pt = canvasCoords(e.clientX, e.clientY);
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.9;
    onCameraChange((prev) =>
      zoomCameraAtPoint(
        prev,
        prev.zoom * zoomFactor,
        pt.x,
        pt.y,
        viewportSize.width,
        viewportSize.height,
        activeGridDims.cols,
        activeGridDims.rows,
      ),
    );
  };

  // Precompute accessible DOM scene graph items
  const emptyFacilitySlots = useMemo(() => {
    if (viewMode !== "facility" || !facilityDc) return [];
    const occupied = new Set(facilityDc.placements.map((p) => `${p.row}:${p.position}`));
    const slots: Array<{ row: number; position: number }> = [];
    for (let r = 0; r < facilityDc.spec.rows; r++) {
      for (let p = 0; p < facilityDc.spec.positionsPerRow; p++) {
        if (!occupied.has(`${r}:${p}`)) {
          slots.push({ row: r, position: p });
        }
      }
    }
    return slots;
  }, [viewMode, facilityDc]);

  const vacantLotCount = Math.max(0, MAX_DISTRICT_PLOTS - cityDcSummaries.length);

  return (
    <div ref={containerRef} className={styles.viewport}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        aria-label={viewMode === "city" ? "Isometric 3D City District Canvas" : "Isometric 3D Datacenter Cutaway Canvas"}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          dragRef.current = null;
          hoveredCityRef.current = null;
          hoveredFloorRef.current = null;
        }}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
      />

      {/* Semantic Accessible DOM Scene Overlay synchronized with live simulation */}
      <div className={styles.a11yOverlay} data-testid="iso-a11y-overlay">
        {viewMode === "city" && effectiveRegion && (
          <>
            {cityDcSummaries.map(({ datacenter }) => (
              <div key={datacenter.id}>
                <button
                  type="button"
                  onClick={() => onSelect({ kind: "datacenter", dcId: datacenter.id })}
                >
                  Inspect {datacenter.name}
                </button>
                <button
                  type="button"
                  onClick={() => onEnterFacility(datacenter.id, effectiveRegion.id)}
                >
                  Enter {datacenter.name} 3D Cutaway
                </button>
              </div>
            ))}
            {Array.from({ length: vacantLotCount }, (_, idx) => (
              <button
                key={`lot-${idx}`}
                type="button"
                onClick={() => onOpenBuildDcModal(effectiveRegion.id)}
              >
                Build Datacenter on Lot {idx + 1}
              </button>
            ))}
            {LANDMARK_BUTTONS.map((lm) => (
              <button
                key={lm.id}
                type="button"
                onClick={() =>
                  onSelect({ kind: "landmark", landmarkId: lm.id, label: lm.label })
                }
              >
                Inspect {lm.label}
              </button>
            ))}
          </>
        )}

        {viewMode === "facility" && facilityDc && (
          <>
            {facilityDc.placements.map((placement) => (
              <button
                key={placement.id}
                type="button"
                onClick={() => handleRackActivate(placement)}
              >
                Rack {placement.specId} at Row {placement.row + 1} Bay {placement.position + 1}
              </button>
            ))}
            {emptyFacilitySlots.map((slot) => (
              <button
                key={`slot-${slot.row}-${slot.position}`}
                type="button"
                onClick={() => handleSlotActivate(slot.row, slot.position)}
              >
                Empty Slot Row {slot.row + 1} Bay {slot.position + 1}
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
