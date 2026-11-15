import { describe, expect, it } from "vitest";
import {
  datacenterUsage,
  newGame,
  summarizeDatacenterInfrastructureFromState,
  type DatacenterId,
  type DatacenterSpecId,
} from "@datacenter-tycoon/game-logic";
import {
  createGameStore,
  selectDatacenterFabricSummary,
  selectRegionFabricSummary,
} from "@datacenter-tycoon/web";
import { createCameraState, rotateCameraCW } from "./camera.js";
import { CITY_GRID_SIZE, renderCityScene, type CityDatacenterSummary } from "./cityScene.js";
import { pickTopHitTarget, projectIso } from "./isoMath.js";
import type { InfoOverlayMode } from "./rackModels3d.js";

function createCanvasCtx(): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");
  return ctx;
}

describe("cityScene", () => {
  it("renders a 12x12 district with datacenters, vacant lots, municipal hubs, and hit targets", () => {
    const ctx = createCanvasCtx();
    const initial = newGame(101, {
      playerName: "Skyline Corp",
      difficulty: "easy",
      startingCash: 50_000_000,
    });
    const store = createGameStore(initial);
    const region = initial.map.regions[0]!;

    const dcSpecs = ["garage", "warehouse", "hyperscale"] as DatacenterSpecId[];
    dcSpecs.forEach((specId, idx) => {
      store.dispatch({
        type: "BuildDatacenter",
        specId,
        dcId: `dc-city-${idx}` as DatacenterId,
        regionId: region.id,
      });
    });

    const state = store.getState();
    const summaries: CityDatacenterSummary[] = state.datacenters.map((datacenter) => {
      const infrastructure = summarizeDatacenterInfrastructureFromState(state, datacenter.id);
      const fabric = selectDatacenterFabricSummary(state, datacenter.id);
      return {
        datacenter,
        infrastructure,
        usage: datacenterUsage(datacenter),
        activeContractCount: 1,
        repairingRackCount: 0,
        fabricConnected: fabric?.fabricConnected ?? false,
      };
    });

    const regionFabric = selectRegionFabricSummary(state, region.id);
    const overlays: InfoOverlayMode[] = ["standard", "power", "thermal", "network", "maintenance"];
    let cam = createCameraState(CITY_GRID_SIZE, CITY_GRID_SIZE);

    for (const overlayMode of overlays) {
      const targets = renderCityScene(ctx, 1280, 720, {
        region,
        datacenters: summaries,
        regionFabric,
        camera: cam,
        overlayMode,
        selectedDcId: summaries[0]!.datacenter.id,
        hoveredTarget: null,
        buildDcToolActive: true,
        timeSec: 3.2,
      });

      const dcTargets = targets.filter((t) => t.kind === "datacenter");
      const lotTargets = targets.filter((t) => t.kind === "vacant_lot");
      const landmarkTargets = targets.filter((t) => t.kind === "landmark");

      expect(dcTargets).toHaveLength(3);
      expect(lotTargets).toHaveLength(3);
      expect(landmarkTargets).toHaveLength(3);

      // Verify hit-testing picks a datacenter plot at its projected center
      const firstDc = dcTargets[0]!;
      const dcScreen = projectIso(
        { gx: firstDc.gx + 0.9, gy: firstDc.gy + 0.9, gz: 0.4 },
        {
          centerX: cam.centerX,
          centerY: cam.centerY,
          zoom: cam.zoom,
          rotation: cam.rotation,
          gridCols: CITY_GRID_SIZE,
          gridRows: CITY_GRID_SIZE,
        },
        1280,
        720,
      );
      const picked = pickTopHitTarget(dcScreen.x, dcScreen.y, targets);
      expect(picked?.kind).toBe("datacenter");

      cam = rotateCameraCW(cam);
    }
  });
});
