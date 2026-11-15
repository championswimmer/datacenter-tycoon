import { describe, expect, it } from "vitest";
import { RACK_CATALOG, type RackSpecId } from "@datacenter-tycoon/game-logic";
import { createCameraState, toCameraTransform } from "./camera.js";
import {
  drawProceduralRack3D,
  rackHeightByTier,
  resolveRackOverlayColors,
  type InfoOverlayMode,
} from "./rackModels3d.js";

function createCanvasCtx(): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");
  return ctx;
}

describe("rackModels3d", () => {
  it("increases rack height progressively across Tiers 0 to 3", () => {
    expect(rackHeightByTier(0, "compute")).toBeLessThan(rackHeightByTier(1, "compute"));
    expect(rackHeightByTier(1, "compute")).toBeLessThan(rackHeightByTier(2, "compute"));
    expect(rackHeightByTier(2, "compute")).toBeLessThan(rackHeightByTier(3, "compute"));
    expect(rackHeightByTier(3, "gpu")).toBeGreaterThan(rackHeightByTier(3, "compute"));
  });

  it("renders all rack specs, operational states, ghosts, and info overlay lenses without error", () => {
    const ctx = createCanvasCtx();
    const cam = toCameraTransform(createCameraState(8, 8), 8, 8);
    const specIds = ["C0", "M1", "S2", "G3"] as RackSpecId[];
    const overlays: InfoOverlayMode[] = ["standard", "power", "thermal", "network", "maintenance"];

    for (const specId of specIds) {
      const spec = RACK_CATALOG[specId];
      expect(spec).toBeDefined();
      if (!spec) throw new Error(`Missing rack spec ${specId}`);

      for (const overlayMode of overlays) {
        const res = drawProceduralRack3D(ctx, cam, 800, 600, {
          gx: 2,
          gy: 2,
          spec,
          activityStatus: "active",
          health: "healthy",
          repairCompletionPercent: 100,
          failureProbability: 0.04,
          billedPowerKw: spec.powerDrawKw * 0.85,
          isSelected: overlayMode === "standard",
          isHovered: false,
          overlayMode,
          timeSec: 1.5,
        });
        expect(res.hitPolygon.length).toBeGreaterThanOrEqual(4);
      }

      // Repairing & ghost states
      const repairing = resolveRackOverlayColors({
        gx: 0,
        gy: 0,
        spec,
        activityStatus: "repairing",
        health: "repairing",
        repairCompletionPercent: 45,
        failureProbability: 0.3,
        billedPowerKw: 0,
        isSelected: false,
        isHovered: false,
        overlayMode: "standard",
        timeSec: 0,
      });
      expect(repairing.overlayLabel).toBe("45%");

      const blockedGhost = drawProceduralRack3D(ctx, cam, 800, 600, {
        gx: 4,
        gy: 1,
        spec,
        activityStatus: "idle",
        health: "healthy",
        repairCompletionPercent: 100,
        failureProbability: 0,
        billedPowerKw: 0,
        isSelected: false,
        isHovered: true,
        isGhost: true,
        ghostValid: false,
        overlayMode: "standard",
        timeSec: 0,
      });
      expect(blockedGhost.hitPolygon.length).toBeGreaterThanOrEqual(4);
    }
  });
});
