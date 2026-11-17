import { describe, expect, it } from "vitest";
import {
  computeDepthKey,
  pickTopHitTarget,
  pointInPolygon,
  projectIso,
  projectPrismSilhouette,
  rotateGridCoord,
  unprojectIso,
  unrotateRotatedCoord,
  type CameraTransform,
  type IsoRotation,
} from "./isoMath.js";

describe("isoMath", () => {
  const baseCam: CameraTransform = {
    centerX: 4,
    centerY: 2,
    zoom: 1,
    rotation: 0,
    gridCols: 8,
    gridRows: 4,
  };

  it("round-trips grid coordinates through 90-degree rotations", () => {
    const rotations: IsoRotation[] = [0, 1, 2, 3];
    for (const rot of rotations) {
      for (const [gx, gy] of [
        [0, 0],
        [3.5, 1.5],
        [8, 4],
        [1.25, 3.75],
      ] as const) {
        const rotated = rotateGridCoord(gx, gy, 8, 4, rot);
        const restored = unrotateRotatedCoord(rotated.rx, rotated.ry, 8, 4, rot);
        expect(restored.gx).toBeCloseTo(gx, 9);
        expect(restored.gy).toBeCloseTo(gy, 9);
      }
    }
  });

  it("centers camera focus at the exact viewport midpoint across every rotation and zoom", () => {
    for (const rot of [0, 1, 2, 3] as const) {
      for (const zoom of [0.6, 1, 1.8]) {
        const cam: CameraTransform = { ...baseCam, rotation: rot, zoom };
        const screen = projectIso({ gx: 4, gy: 2, gz: 0 }, cam, 1280, 720);
        expect(screen.x).toBeCloseTo(640, 9);
        expect(screen.y).toBeCloseTo(360, 9);
      }
    }
  });

  it("round-trips projectIso and unprojectIso at multiple elevations and rotations", () => {
    for (const rot of [0, 1, 2, 3] as const) {
      const cam: CameraTransform = { ...baseCam, rotation: rot, zoom: 1.35 };
      const pt = { gx: 6.25, gy: 1.75, gz: 1.4 };
      const projected = projectIso(pt, cam, 1000, 700);
      const unprojected = unprojectIso(projected.x, projected.y, cam, 1000, 700, pt.gz);
      expect(unprojected.gx).toBeCloseTo(pt.gx, 8);
      expect(unprojected.gy).toBeCloseTo(pt.gy, 8);
    }
  });

  it("orders painter depth keys monotonically toward camera front under every rotation", () => {
    // At rotation 0, (7,3) is front-most and (0,0) is back-most
    expect(computeDepthKey(7, 3, 0, 8, 4, 0)).toBeGreaterThan(
      computeDepthKey(0, 0, 0, 8, 4, 0),
    );
    // At rotation 2 (180 deg flip), (0,0) moves to front-most and (7,3) is back-most
    expect(computeDepthKey(0, 0, 0, 8, 4, 2)).toBeGreaterThan(
      computeDepthKey(7, 3, 0, 8, 4, 2),
    );
    // Higher elevation on the same tile renders later than the floor below it
    expect(computeDepthKey(3, 2, 1.5, 8, 4, 0)).toBeGreaterThan(
      computeDepthKey(3, 2, 0, 8, 4, 0),
    );
  });

  it("detects polygon point hits and picks front-most overlapping prism", () => {
    const backSil = projectPrismSilhouette(2, 1, 0, 1, 1, 2, baseCam, 800, 600);
    const frontSil = projectPrismSilhouette(3, 2, 0, 1, 1, 2, baseCam, 800, 600);
    const frontCenter = projectIso({ gx: 3.5, gy: 2.5, gz: 0.9 }, baseCam, 800, 600);

    expect(pointInPolygon(frontCenter.x, frontCenter.y, frontSil)).toBe(true);

    const hit = pickTopHitTarget(frontCenter.x, frontCenter.y, [
      { id: "back", hitPolygon: backSil, depth: computeDepthKey(2.5, 1.5, 0, 8, 4, 0) },
      { id: "front", hitPolygon: frontSil, depth: computeDepthKey(3.5, 2.5, 0, 8, 4, 0) },
    ]);
    expect(hit?.id).toBe("front");
  });
});
