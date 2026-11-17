import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type SetStateAction,
} from "react";
import type {
  DatacenterId,
  RackPlacementId,
  RegionId,
} from "@datacenter-tycoon/game-logic";
import { navigate, useRoute } from "../../router/hashRouter.js";
import {
  selectAllDatacenters,
  selectDatacenter,
  selectRegions,
} from "../../store/selectors.js";
import {
  useGameDispatch,
  useSelector,
  useTickDriver,
} from "../../store/storeContext.js";
import type { Speed } from "../../store/tickDriver.js";
import { hasSeenTutorial } from "../../store/tutorialPersist.js";
import { ContractsPage } from "../contracts/ContractsPage.js";
import { FinancesPage } from "../finances/FinancesPage.js";
import { MoveRackModal } from "../floor/MoveRackModal.js";
import { RackPicker } from "../floor/RackPicker.js";
import { TutorialModal } from "../help/TutorialModal.js";
import { LogFeed } from "../log/LogFeed.js";
import { MapView } from "../map/MapView.js";
import { NewDatacenterModal } from "../onboarding/NewDatacenterModal.js";
import { AudioSettingsModal } from "../settings/AudioSettingsModal.js";
import { PowerView } from "../stats/PowerView.js";
import type { UpgradePanelFocus } from "../stats/UpgradePanel.js";
import { ResetGameModal } from "../topbar/ResetGameModal.js";
import {
  createCameraState,
  fitCameraToGrid,
  type ViewportInsets,
  panCameraGrid,
  rotateCameraCCW,
  rotateCameraCW,
  toggleCutaway,
  zoomCameraAtPoint,
  type IsoCameraState,
} from "../../engine/camera.js";
import { CITY_GRID_SIZE } from "../../engine/cityScene.js";
import type { InfoOverlayMode } from "../../engine/rackModels3d.js";
import {
  createInitialViewportState,
  viewportReducer,
} from "../../state/viewportState.js";
import { InfoOverlayDock } from "../hud/InfoOverlayDock.js";
import { InspectorPanel } from "../hud/InspectorPanel.js";
import { BuildDock } from "../hud/BuildDock.js";
import { TopHudBar } from "../hud/TopHudBar.js";
import { IsoViewportCanvas } from "../viewport/IsoViewportCanvas.js";
import { InfrastructureUpgradeDialog } from "../modals/InfrastructureUpgradeDialog.js";
import styles from "./IsoShell.module.css";

export interface IsoShellProps {
  shouldAutoOpenTutorial?: boolean;
}

const OVERLAY_BY_KEY: Record<string, InfoOverlayMode> = {
  "1": "standard",
  "2": "power",
  "3": "thermal",
  "4": "network",
  "5": "maintenance",
};

const DRAWER_TITLES = {
  contracts: "📋 Contracts Market & SLA Operations",
  finances: "💹 Financial Ledger & Cash Flow",
  upgrades: "⚡ Power Grid & Facility Upgrades",
  map: "🌍 Global Regions & Optical Fabric",
  log: "📜 Activity & Transaction Ledger",
} as const;

/** Screen margins covered by HUD panels (left info dock, right inspector, top bar, bottom build dock). */
const HUD_INSETS: ViewportInsets = { left: 204, right: 312, top: 72, bottom: 112 };

/** Trailing arguments for fitCameraToGrid so scenes fit the unobstructed viewport area. */
function hudFitArgs(): [number, number, number, number, ViewportInsets] {
  const w = typeof window !== "undefined" && window.innerWidth ? window.innerWidth : 1280;
  const h = typeof window !== "undefined" && window.innerHeight ? window.innerHeight : 720;
  return [w, h, 3.2, 0.92, HUD_INSETS];
}

export function IsoShell({ shouldAutoOpenTutorial = false }: IsoShellProps) {
  const dispatch = useGameDispatch();
  const regions = useSelector(selectRegions);
  const datacenters = useSelector(selectAllDatacenters);
  const speed = useSelector((state) => state.game.speed as Speed);
  const route = useRoute();

  const [state, viewDispatch] = useReducer(
    viewportReducer,
    undefined,
    () =>
      createInitialViewportState(
        regions[0]?.id ?? null,
        datacenters[0]?.id ?? null,
      ),
  );

  // Focused single-track upgrade dialog opened from 3D equipment / city landmarks
  const [upgradeDialog, setUpgradeDialog] = useState<{
    dcId: DatacenterId;
    focus: UpgradePanelFocus;
  } | null>(null);

  const [camera, setCamera] = useState<IsoCameraState>(() => {
    const initialDc = datacenters[0];
    if (initialDc) {
      return fitCameraToGrid(
        createCameraState(initialDc.spec.positionsPerRow, initialDc.spec.rows),
        initialDc.spec.positionsPerRow,
        initialDc.spec.rows,
        ...hudFitArgs(),
      );
    }
    return fitCameraToGrid(
      createCameraState(CITY_GRID_SIZE, CITY_GRID_SIZE),
      CITY_GRID_SIZE,
      CITY_GRID_SIZE,
      ...hudFitArgs(),
    );
  });

  const [rackPickerTarget, setRackPickerTarget] = useState<{
    dcId: DatacenterId;
    row: number;
    position: number;
  } | null>(null);
  const [moveRackTarget, setMoveRackTarget] = useState<{
    dcId: DatacenterId;
    placementId: RackPlacementId;
  } | null>(null);
  const [buildDcRegionId, setBuildDcRegionId] = useState<RegionId | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const toastTimerRef = useRef<number | null>(null);
  const prevRouteRef = useRef<string>("");
  const prevDcCountRef = useRef<number>(datacenters.length);

  const setSpeed = useCallback(
    (value: SetStateAction<Speed>) => {
      const next = typeof value === "function" ? value(speed) : value;
      dispatch({ type: "SetSpeed", speed: next });
    },
    [dispatch, speed],
  );

  const getSpeed = useCallback(() => speed, [speed]);
  useTickDriver(getSpeed);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 3200);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Auto-open tutorial on fresh session
  useEffect(() => {
    if (shouldAutoOpenTutorial && !hasSeenTutorial()) {
      setShowTutorial(true);
    }
  }, [shouldAutoOpenTutorial]);

  const activeDc = useSelector((gameState) =>
    state.activeDcId ? selectDatacenter(gameState, state.activeDcId) : undefined,
  );
  const rackPickerDc = useSelector((gameState) =>
    rackPickerTarget ? selectDatacenter(gameState, rackPickerTarget.dcId) : undefined,
  );

  const fitCameraForMode = useCallback(
    (mode: "city" | "facility", dcId?: DatacenterId) => {
      const dc = dcId ? datacenters.find((d) => d.id === dcId) : activeDc;
      if (mode === "facility" && dc) {
        setCamera((prev) =>
          fitCameraToGrid(
            {
              ...createCameraState(dc.spec.positionsPerRow, dc.spec.rows),
              rotation: prev.rotation,
              cutaway: prev.cutaway,
            },
            dc.spec.positionsPerRow,
            dc.spec.rows,
            ...hudFitArgs(),
          ),
        );
      } else {
        setCamera((prev) =>
          fitCameraToGrid(
            {
              ...createCameraState(CITY_GRID_SIZE, CITY_GRID_SIZE),
              rotation: prev.rotation,
              cutaway: prev.cutaway,
            },
            CITY_GRID_SIZE,
            CITY_GRID_SIZE,
            ...hudFitArgs(),
          ),
        );
      }
    },
    [datacenters, activeDc],
  );

  const enterCity = useCallback(() => {
    navigate({ view: "home" });
    viewDispatch({ type: "ENTER_CITY_VIEW" });
    fitCameraForMode("city");
  }, [fitCameraForMode]);

  const enterFacility = useCallback(
    (dcId: DatacenterId, regionId?: RegionId) => {
      const targetDc = datacenters.find((d) => d.id === dcId);
      viewDispatch({
        type: "ENTER_FACILITY_VIEW",
        dcId,
        regionId: regionId ?? targetDc?.regionId,
      });
      viewDispatch({ type: "SET_ACTIVE_DRAWER", drawer: "none" });
      fitCameraForMode("facility", dcId);
    },
    [datacenters, fitCameraForMode],
  );

  // Sync external navigation triggers (e.g., NewDatacenterModal calling navigateToDc)
  useEffect(() => {
    const key = route.view === "dc" ? `dc:${route.dcId}:${route.tab}` : route.view;
    if (key === prevRouteRef.current) return;
    prevRouteRef.current = key;

    if (route.view === "dc") {
      const target = datacenters.find((d) => d.id === route.dcId);
      if (target) {
        enterFacility(target.id, target.regionId);
      }
    }
  }, [route, datacenters, enterFacility]);

  // If a brand new datacenter is constructed, enter its 3D facility cutaway
  useEffect(() => {
    if (datacenters.length > prevDcCountRef.current) {
      const newest = datacenters[datacenters.length - 1];
      if (newest) {
        enterFacility(newest.id, newest.regionId);
      }
    }
    prevDcCountRef.current = datacenters.length;
  }, [datacenters, enterFacility]);

  const gridCols =
    state.viewMode === "facility" && activeDc ? activeDc.spec.positionsPerRow : CITY_GRID_SIZE;
  const gridRows =
    state.viewMode === "facility" && activeDc ? activeDc.spec.rows : CITY_GRID_SIZE;

  // Global camera & overlay hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key === "Escape") {
        if (state.activeDrawer !== "none") {
          viewDispatch({ type: "SET_ACTIVE_DRAWER", drawer: "none" });
        } else {
          viewDispatch({ type: "CLEAR_TOOL_AND_SELECTION" });
        }
        return;
      }

      if (rackPickerTarget || moveRackTarget || buildDcRegionId || showTutorial || showAudioModal || showResetModal) {
        return;
      }

      const overlay = OVERLAY_BY_KEY[e.key];
      if (overlay) {
        viewDispatch({ type: "SET_OVERLAY_MODE", overlayMode: overlay });
        return;
      }

      const lower = e.key.toLowerCase();
      if (lower === "q") {
        setCamera((prev) => rotateCameraCCW(prev));
      } else if (lower === "e") {
        setCamera((prev) => rotateCameraCW(prev));
      } else if (lower === "c" && state.viewMode === "facility") {
        setCamera((prev) => toggleCutaway(prev));
      } else if (e.key === "+" || e.key === "=") {
        setCamera((prev) =>
          zoomCameraAtPoint(prev, prev.zoom * 1.15, 640, 360, 1280, 720, gridCols, gridRows),
        );
      } else if (e.key === "-") {
        setCamera((prev) =>
          zoomCameraAtPoint(prev, prev.zoom / 1.15, 640, 360, 1280, 720, gridCols, gridRows),
        );
      } else if (lower === "w" || e.key === "ArrowUp") {
        setCamera((prev) => panCameraGrid(prev, -0.6, -0.6, gridCols, gridRows));
      } else if (lower === "s" || e.key === "ArrowDown") {
        setCamera((prev) => panCameraGrid(prev, 0.6, 0.6, gridCols, gridRows));
      } else if (lower === "a" || e.key === "ArrowLeft") {
        setCamera((prev) => panCameraGrid(prev, -0.6, 0.6, gridCols, gridRows));
      } else if (lower === "d" || e.key === "ArrowRight") {
        setCamera((prev) => panCameraGrid(prev, 0.6, -0.6, gridCols, gridRows));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    state.activeDrawer,
    state.viewMode,
    gridCols,
    gridRows,
    rackPickerTarget,
    moveRackTarget,
    buildDcRegionId,
    showTutorial,
    showAudioModal,
    showResetModal,
  ]);

  const fallbackRegionId = state.activeRegionId ?? regions[0]?.id ?? null;

  return (
    <div className={styles.shell}>
      <TopHudBar
        viewMode={state.viewMode}
        activeRegionId={state.activeRegionId}
        activeDcId={state.activeDcId}
        speed={speed}
        onSpeedChange={setSpeed}
        onEnterCity={enterCity}
        onSelectRegion={(regionId) => {
          viewDispatch({ type: "SET_ACTIVE_REGION", regionId });
          if (state.viewMode === "facility") {
            enterCity();
          } else {
            fitCameraForMode("city");
          }
        }}
        onEnterFacility={(dcId) => enterFacility(dcId)}
        onOpenTutorial={() => setShowTutorial(true)}
        onOpenAudioSettings={() => setShowAudioModal(true)}
        onOpenResetModal={() => setShowResetModal(true)}
      />

      <main className={styles.stage} aria-label="Isometric 3D Game Viewport">
        <IsoViewportCanvas
          viewMode={state.viewMode}
          activeRegionId={state.activeRegionId}
          activeDcId={state.activeDcId}
          camera={camera}
          onCameraChange={setCamera}
          overlayMode={state.overlayMode}
          buildTool={state.buildTool}
          selection={state.selection}
          onSelect={(selection) => {
            viewDispatch({ type: "SET_SELECTION", selection });
            if (
              selection.kind === "landmark" &&
              (selection.landmarkId === "power_substation" ||
                selection.landmarkId === "fiber_exchange")
            ) {
              const regionDcs = datacenters.filter(
                (dc) => dc.regionId === fallbackRegionId,
              );
              const target =
                regionDcs.find((dc) => dc.id === state.activeDcId) ?? regionDcs[0];
              if (target) {
                setUpgradeDialog({
                  dcId: target.id,
                  focus: selection.landmarkId === "power_substation" ? "power" : "network",
                });
              } else {
                showToast("Build a datacenter in this region to purchase power or fiber upgrades.");
              }
            }
          }}
          onEnterFacility={enterFacility}
          onOpenBuildDcModal={(regionId) => setBuildDcRegionId(regionId)}
          onActionFeedback={showToast}
          onOpenEquipmentUpgrade={(dcId, equipmentId) =>
            setUpgradeDialog({
              dcId,
              focus:
                equipmentId === "crac" ? "cooling" : equipmentId === "noc" ? "network" : "power",
            })
          }
          speed={speed}
        />

        <InfoOverlayDock
          overlayMode={state.overlayMode}
          rotation={camera.rotation}
          zoom={camera.zoom}
          cutaway={camera.cutaway}
          viewMode={state.viewMode}
          onSelectOverlay={(overlayMode) =>
            viewDispatch({ type: "SET_OVERLAY_MODE", overlayMode })
          }
          onRotateCCW={() => setCamera((prev) => rotateCameraCCW(prev))}
          onRotateCW={() => setCamera((prev) => rotateCameraCW(prev))}
          onZoomIn={() =>
            setCamera((prev) =>
              zoomCameraAtPoint(prev, prev.zoom * 1.18, 640, 360, 1280, 720, gridCols, gridRows),
            )
          }
          onZoomOut={() =>
            setCamera((prev) =>
              zoomCameraAtPoint(prev, prev.zoom / 1.18, 640, 360, 1280, 720, gridCols, gridRows),
            )
          }
          onFitView={() => fitCameraForMode(state.viewMode)}
          onToggleCutaway={() => setCamera((prev) => toggleCutaway(prev))}
        />

        <InspectorPanel
          selection={state.selection}
          activeRegionId={fallbackRegionId}
          activeDcId={state.activeDcId}
          buildTool={state.buildTool}
          onEnterFacility={(dcId) => enterFacility(dcId)}
          onEnterCity={enterCity}
          onOpenRackPicker={(dcId, row, position) =>
            setRackPickerTarget({ dcId, row, position })
          }
          onOpenMoveRackModal={(dcId, placementId) =>
            setMoveRackTarget({ dcId, placementId })
          }
          onOpenUpgrades={() =>
            viewDispatch({ type: "TOGGLE_DRAWER", drawer: "upgrades" })
          }
          onOpenBuildDcModal={() => {
            if (fallbackRegionId) setBuildDcRegionId(fallbackRegionId);
          }}
          onClearSelection={() =>
            viewDispatch({ type: "CLEAR_TOOL_AND_SELECTION" })
          }
        />

        <BuildDock
          viewMode={state.viewMode}
          buildTool={state.buildTool}
          activeDrawer={state.activeDrawer}
          onSelectTool={(tool) => viewDispatch({ type: "SELECT_BUILD_TOOL", tool })}
          onToggleDrawer={(drawer) => viewDispatch({ type: "TOGGLE_DRAWER", drawer })}
          onOpenBuildDcModal={() => {
            if (fallbackRegionId) setBuildDcRegionId(fallbackRegionId);
          }}
        />

        {toastMessage && (
          <div className={styles.toast} role="status">
            {toastMessage}
          </div>
        )}

        {state.activeDrawer !== "none" && (
          <section
            className={styles.drawerBackdrop}
            aria-label={DRAWER_TITLES[state.activeDrawer]}
            role="dialog"
          >
            <div className={styles.drawerPanel}>
              <div className={styles.drawerHeader}>
                <h2 className={styles.drawerTitle}>{DRAWER_TITLES[state.activeDrawer]}</h2>
                <button
                  type="button"
                  className={styles.drawerClose}
                  onClick={() => viewDispatch({ type: "SET_ACTIVE_DRAWER", drawer: "none" })}
                  aria-label="Close Drawer"
                >
                  ✕
                </button>
              </div>
              <div className={styles.drawerBody}>
                {state.activeDrawer === "contracts" && <ContractsPage />}
                {state.activeDrawer === "finances" && <FinancesPage />}
                {state.activeDrawer === "map" && <MapView />}
                {state.activeDrawer === "log" && <LogFeed />}
                {state.activeDrawer === "upgrades" &&
                  (state.activeDcId ? (
                    <PowerView dcId={state.activeDcId} />
                  ) : (
                    <p className={styles.emptyDrawerNote}>
                      Build or select a datacenter first to configure Power, Cooling, Fiber, and Onsite Generation upgrades.
                    </p>
                  ))}
              </div>
            </div>
          </section>
        )}
      </main>

      {upgradeDialog && (
        <InfrastructureUpgradeDialog
          dcId={upgradeDialog.dcId}
          focus={upgradeDialog.focus}
          onClose={() => setUpgradeDialog(null)}
        />
      )}

      {rackPickerTarget && rackPickerDc && (
        <RackPicker
          datacenter={rackPickerDc}
          row={rackPickerTarget.row}
          position={rackPickerTarget.position}
          onClose={() => setRackPickerTarget(null)}
        />
      )}

      {moveRackTarget && (
        <MoveRackModal
          sourceDcId={moveRackTarget.dcId}
          placementId={moveRackTarget.placementId}
          onClose={() => setMoveRackTarget(null)}
        />
      )}

      {buildDcRegionId && (
        <NewDatacenterModal
          regionId={buildDcRegionId}
          onClose={() => setBuildDcRegionId(null)}
        />
      )}

      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}
      {showAudioModal && <AudioSettingsModal onClose={() => setShowAudioModal(false)} />}
      {showResetModal && <ResetGameModal onClose={() => setShowResetModal(false)} />}
    </div>
  );
}
