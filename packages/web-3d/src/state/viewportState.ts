import type {
  DatacenterId,
  DatacenterSpecId,
  RackPlacementId,
  RackSpecId,
  RegionId,
} from "@datacenter-tycoon/game-logic";
import type { InfoOverlayMode } from "../engine/rackModels3d.js";

export type CameraViewMode = "city" | "facility";

export type BuildTool =
  | { mode: "select" }
  | { mode: "place_rack"; specId: RackSpecId }
  | { mode: "bulldozer" }
  | { mode: "build_dc"; specId?: DatacenterSpecId };

export type ActiveDrawer =
  | "none"
  | "contracts"
  | "finances"
  | "upgrades"
  | "map"
  | "log";

export type SelectionTarget =
  | { kind: "none" }
  | { kind: "datacenter"; dcId: DatacenterId }
  | {
      kind: "rack";
      dcId: DatacenterId;
      placementId: RackPlacementId;
      row: number;
      position: number;
    }
  | { kind: "slot"; dcId: DatacenterId; row: number; position: number }
  | { kind: "landmark"; landmarkId: string; label: string };

export interface ViewportState {
  viewMode: CameraViewMode;
  activeRegionId: RegionId | null;
  activeDcId: DatacenterId | null;
  buildTool: BuildTool;
  overlayMode: InfoOverlayMode;
  activeDrawer: ActiveDrawer;
  selection: SelectionTarget;
}

export type ViewportAction =
  | { type: "ENTER_CITY_VIEW"; regionId?: RegionId | null }
  | { type: "ENTER_FACILITY_VIEW"; dcId: DatacenterId; regionId?: RegionId }
  | { type: "SET_ACTIVE_REGION"; regionId: RegionId }
  | { type: "SELECT_BUILD_TOOL"; tool: BuildTool }
  | { type: "SET_OVERLAY_MODE"; overlayMode: InfoOverlayMode }
  | { type: "SET_ACTIVE_DRAWER"; drawer: ActiveDrawer }
  | { type: "TOGGLE_DRAWER"; drawer: Exclude<ActiveDrawer, "none"> }
  | { type: "SET_SELECTION"; selection: SelectionTarget }
  | { type: "CLEAR_TOOL_AND_SELECTION" };

export function createInitialViewportState(
  initialRegionId: RegionId | null = null,
  initialDcId: DatacenterId | null = null,
): ViewportState {
  return {
    viewMode: initialDcId ? "facility" : "city",
    activeRegionId: initialRegionId,
    activeDcId: initialDcId,
    buildTool: { mode: "select" },
    overlayMode: "standard",
    activeDrawer: "none",
    selection: initialDcId ? { kind: "datacenter", dcId: initialDcId } : { kind: "none" },
  };
}

export function viewportReducer(
  state: ViewportState,
  action: ViewportAction,
): ViewportState {
  switch (action.type) {
    case "ENTER_CITY_VIEW":
      return {
        ...state,
        viewMode: "city",
        activeRegionId: action.regionId !== undefined ? action.regionId : state.activeRegionId,
        buildTool:
          state.buildTool.mode === "place_rack" || state.buildTool.mode === "bulldozer"
            ? { mode: "select" }
            : state.buildTool,
        selection: state.activeDcId
          ? { kind: "datacenter", dcId: state.activeDcId }
          : { kind: "none" },
      };

    case "ENTER_FACILITY_VIEW":
      return {
        ...state,
        viewMode: "facility",
        activeDcId: action.dcId,
        activeRegionId: action.regionId ?? state.activeRegionId,
        buildTool: state.buildTool.mode === "build_dc" ? { mode: "select" } : state.buildTool,
        selection: { kind: "datacenter", dcId: action.dcId },
      };

    case "SET_ACTIVE_REGION":
      return {
        ...state,
        activeRegionId: action.regionId,
        selection: { kind: "none" },
      };

    case "SELECT_BUILD_TOOL":
      return {
        ...state,
        buildTool: action.tool,
      };

    case "SET_OVERLAY_MODE":
      return {
        ...state,
        overlayMode: action.overlayMode,
      };

    case "SET_ACTIVE_DRAWER":
      return {
        ...state,
        activeDrawer: action.drawer,
      };

    case "TOGGLE_DRAWER":
      return {
        ...state,
        activeDrawer: state.activeDrawer === action.drawer ? "none" : action.drawer,
      };

    case "SET_SELECTION":
      return {
        ...state,
        selection: action.selection,
      };

    case "CLEAR_TOOL_AND_SELECTION":
      return {
        ...state,
        buildTool: { mode: "select" },
        selection:
          state.viewMode === "facility" && state.activeDcId
            ? { kind: "datacenter", dcId: state.activeDcId }
            : { kind: "none" },
      };
  }
}
