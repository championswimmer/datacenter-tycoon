import { describe, expect, it } from "vitest";
import type {
  DatacenterId,
  RackPlacementId,
  RackSpecId,
  RegionId,
} from "@datacenter-tycoon/game-logic";
import { createInitialViewportState, viewportReducer } from "./viewportState.js";

describe("viewportState", () => {
  const regionId = "reg-us-east" as RegionId;
  const dcId = "dc-1" as DatacenterId;
  const rackId = "rack-1" as RackPlacementId;

  it("initializes in city view by default or facility view when dcId is provided", () => {
    const cityInit = createInitialViewportState(regionId);
    expect(cityInit.viewMode).toBe("city");
    expect(cityInit.activeRegionId).toBe(regionId);
    expect(cityInit.selection).toEqual({ kind: "none" });

    const dcInit = createInitialViewportState(regionId, dcId);
    expect(dcInit.viewMode).toBe("facility");
    expect(dcInit.activeDcId).toBe(dcId);
    expect(dcInit.selection).toEqual({ kind: "datacenter", dcId });
  });

  it("transitions smoothly between city and facility modes and resets view-specific tools", () => {
    let state = createInitialViewportState(regionId);

    state = viewportReducer(state, { type: "SELECT_BUILD_TOOL", tool: { mode: "build_dc" } });
    state = viewportReducer(state, { type: "ENTER_FACILITY_VIEW", dcId });
    expect(state.viewMode).toBe("facility");
    expect(state.buildTool).toEqual({ mode: "select" });
    expect(state.selection).toEqual({ kind: "datacenter", dcId });

    state = viewportReducer(state, {
      type: "SELECT_BUILD_TOOL",
      tool: { mode: "place_rack", specId: "C1" as RackSpecId },
    });
    state = viewportReducer(state, {
      type: "SET_SELECTION",
      selection: { kind: "rack", dcId, placementId: rackId, row: 0, position: 1 },
    });
    state = viewportReducer(state, { type: "ENTER_CITY_VIEW" });
    expect(state.viewMode).toBe("city");
    expect(state.buildTool).toEqual({ mode: "select" });
    expect(state.selection).toEqual({ kind: "datacenter", dcId });
  });

  it("toggles drawers, sets info overlay modes, and clears selections cleanly", () => {
    let state = createInitialViewportState(regionId, dcId);

    state = viewportReducer(state, { type: "SET_OVERLAY_MODE", overlayMode: "thermal" });
    expect(state.overlayMode).toBe("thermal");

    state = viewportReducer(state, { type: "TOGGLE_DRAWER", drawer: "contracts" });
    expect(state.activeDrawer).toBe("contracts");
    state = viewportReducer(state, { type: "TOGGLE_DRAWER", drawer: "contracts" });
    expect(state.activeDrawer).toBe("none");

    state = viewportReducer(state, {
      type: "SELECT_BUILD_TOOL",
      tool: { mode: "bulldozer" },
    });
    state = viewportReducer(state, {
      type: "SET_SELECTION",
      selection: { kind: "slot", dcId, row: 1, position: 2 },
    });
    state = viewportReducer(state, { type: "CLEAR_TOOL_AND_SELECTION" });
    expect(state.buildTool).toEqual({ mode: "select" });
    expect(state.selection).toEqual({ kind: "datacenter", dcId });
  });
});
