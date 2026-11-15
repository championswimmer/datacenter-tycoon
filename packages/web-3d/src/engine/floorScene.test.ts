import { describe, expect, it } from "vitest";
import {
  datacenterUsage,
  newGame,
  RACK_CATALOG,
  summarizeDatacenterInfrastructureFromState,
  type DatacenterId,
  type DatacenterSpecId,
  type RackPlacementId,
  type RackSpecId,
} from "@datacenter-tycoon/game-logic";
import {
  createGameStore,
  selectDatacenterRackActivityViews,
  selectDatacenterRackMaintenanceViews,
  selectDatacenterUpgradeSummary,
} from "@datacenter-tycoon/web";
import { createCameraState, rotateCameraCW, toggleCutaway } from "./camera.js";
import { pickTopHitTarget, projectIso } from "./isoMath.js";
import { renderFloorScene } from "./floorScene.js";
import type { InfoOverlayMode } from "./rackModels3d.js";

function createCanvasCtx(): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");
  return ctx;
}

describe("floorScene", () => {
  it("renders facility cutaway floor, equipment, technicians, racks, and returns hit targets", () => {
    const ctx = createCanvasCtx();
    const initial = newGame(77, { playerName: "Floor Architect", difficulty: "easy" });
    const store = createGameStore(initial);
    const regionId = initial.map.regions[0]!.id;
    const dcId = "dc-floor-1" as DatacenterId;

    store.dispatch({
      type: "BuildDatacenter",
      specId: "warehouse" as DatacenterSpecId,
      dcId,
      regionId,
    });
    store.dispatch({
      type: "PlaceRack",
      dcId,
      specId: "C1" as RackSpecId,
      row: 0,
      position: 0,
      placementId: "rack-a" as RackPlacementId,
    });
    store.dispatch({
      type: "PlaceRack",
      dcId,
      specId: "G2" as RackSpecId,
      row: 1,
      position: 2,
      placementId: "rack-b" as RackPlacementId,
    });
    const upgradeView = selectDatacenterUpgradeSummary(store.getState(), dcId);
    const genTrack = upgradeView?.tracks.find((t) => t.trackId === "onsiteGeneration");
    if (genTrack?.nextNode) {
      store.dispatch({
        type: "UpgradeDatacenter",
        dcId,
        trackId: "onsiteGeneration",
        targetNodeId: genTrack.nextNode.id,
      });
    }

    const state = store.getState();
    const datacenter = state.datacenters[0]!;
    const infrastructure = summarizeDatacenterInfrastructureFromState(state, dcId);
    const usage = datacenterUsage(datacenter);
    const rackActivities = selectDatacenterRackActivityViews(state, dcId);
    const rackMaintenance = selectDatacenterRackMaintenanceViews(state, dcId);

    const overlays: InfoOverlayMode[] = ["standard", "power", "thermal", "network", "maintenance"];
    let cam = createCameraState(datacenter.spec.positionsPerRow, datacenter.spec.rows);

    for (const overlayMode of overlays) {
      const targets = renderFloorScene(ctx, 1280, 720, {
        datacenter,
        infrastructure,
        usage,
        rackActivities,
        rackMaintenance,
        camera: cam,
        overlayMode,
        activeRackSpecId: "C0" as RackSpecId,
        selectedPlacementId: "rack-a" as RackPlacementId,
        selectedSlot: { row: 0, position: 1 },
        hoveredTarget: {
          kind: "slot",
          row: 0,
          position: 1,
          canPlace: true,
          hitPolygon: [],
          depth: 0,
        },
        timeSec: 2.5,
      });

      const rackTargets = targets.filter((t) => t.kind === "rack");
      const slotTargets = targets.filter((t) => t.kind === "slot");
      const eqTargets = targets.filter((t) => t.kind === "equipment");
      expect(rackTargets).toHaveLength(2);
      expect(slotTargets.length).toBe(datacenter.spec.rows * datacenter.spec.positionsPerRow - 2);
      expect(eqTargets.length).toBeGreaterThanOrEqual(3);

      // Verify hit-testing hits rack-a at its projected center
      const rackPt = projectIso(
        { gx: 0.5, gy: 0.5, gz: 0.6 },
        {
          centerX: cam.centerX,
          centerY: cam.centerY,
          zoom: cam.zoom,
          rotation: cam.rotation,
          gridCols: datacenter.spec.positionsPerRow,
          gridRows: datacenter.spec.rows,
        },
        1280,
        720,
      );
      const picked = pickTopHitTarget(rackPt.x, rackPt.y, targets);
      expect(picked?.kind).toBe("rack");

      cam = toggleCutaway(rotateCameraCW(cam));
    }

    expect(RACK_CATALOG["C1"]).toBeDefined();
  });

  it("renders both garage and hyperscale datacenters without error", () => {
    const ctx = createCanvasCtx();
    for (const specId of ["garage", "hyperscale"] as DatacenterSpecId[]) {
      const initial = newGame(99, { difficulty: "easy", startingCash: 50_000_000 });
      const store = createGameStore(initial);
      const regionId = initial.map.regions[0]!.id;
      const dcId = `dc-${specId}` as DatacenterId;

      store.dispatch({
        type: "BuildDatacenter",
        specId,
        dcId,
        regionId,
      });

      const state = store.getState();
      const datacenter = state.datacenters[0]!;
      const infrastructure = summarizeDatacenterInfrastructureFromState(state, dcId);
      const usage = datacenterUsage(datacenter);

      const targets = renderFloorScene(ctx, 1280, 720, {
        datacenter,
        infrastructure,
        usage,
        rackActivities: [],
        rackMaintenance: [],
        camera: createCameraState(datacenter.spec.positionsPerRow, datacenter.spec.rows),
        overlayMode: "standard",
        activeRackSpecId: null,
        selectedPlacementId: null,
        selectedSlot: null,
        hoveredTarget: null,
        timeSec: 0.25,
      });

      expect(targets.filter((t) => t.kind === "slot")).toHaveLength(
        datacenter.spec.rows * datacenter.spec.positionsPerRow,
      );
    }
  });
});
