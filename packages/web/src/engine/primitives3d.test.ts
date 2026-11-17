import { describe, expect, it } from "vitest";
import { createCameraState, rotateCameraCW, toCameraTransform } from "./camera.js";
import {
  drawIsoBadge,
  drawIsoBox,
  drawIsoConduit,
  drawIsoCylinder,
  drawIsoTile,
  drawIsoWindowGrid,
  mixHex,
  visibleCardinalFaces,
} from "./primitives3d.js";

function createCanvasCtx(): CanvasRenderingContext2D {
  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");
  return ctx;
}

describe("primitives3d", () => {
  it("renders isometric tiles, boxes, cylinders, conduits, and badges across all rotations", () => {
    const ctx = createCanvasCtx();
    let cam = createCameraState(8, 8);

    for (let i = 0; i < 4; i++) {
      const transform = toCameraTransform(cam, 8, 8);
      const tileQuad = drawIsoTile(ctx, transform, 800, 600, {
        gx: 2,
        gy: 3,
        fill: "#101824",
        stroke: "#00f5d4",
      });
      expect(tileQuad).toHaveLength(4);

      const box = drawIsoBox(ctx, transform, 800, 600, {
        gx: 2.1,
        gy: 3.1,
        gz: 0,
        sx: 0.8,
        sy: 0.8,
        hz: 1.5,
        topColor: "#24344d",
        leftColor: "#142030",
        rightColor: "#1b2b40",
        strokeColor: "#00f5d4",
      });
      expect(box.topQuad).toHaveLength(4);
      expect(box.frontLeftQuad).toHaveLength(4);
      expect(box.frontRightQuad).toHaveLength(4);
      expect(box.hitPolygon.length).toBeGreaterThanOrEqual(4);

      drawIsoWindowGrid(ctx, box.frontLeftQuad, 4, 2, (r) => (r % 2 === 0 ? "#00f5d4" : null));
      drawIsoCylinder(ctx, transform, 800, 600, {
        gx: 5.5,
        gy: 5.5,
        gz: 0,
        radius: 0.35,
        height: 1.2,
        topColor: "#2d3f58",
        sideLeftColor: "#152232",
        sideRightColor: "#22344b",
      });
      const conduitPts = drawIsoConduit(
        ctx,
        transform,
        800,
        600,
        [
          { gx: 0, gy: 0, gz: -0.1 },
          { gx: 4, gy: 0, gz: -0.1 },
          { gx: 4, gy: 4, gz: -0.1 },
        ],
        { color: "#00b4d8", dashed: true },
      );
      expect(conduitPts).toHaveLength(3);
      drawIsoBadge(ctx, box.topQuad[0], "C3 GPU");
      cam = rotateCameraCW(cam);
    }
  });

  it("maps visible cardinal faces consistently through rotation and mixes colors", () => {
    expect(visibleCardinalFaces(0)).toEqual({ frontLeft: "S", frontRight: "E" });
    expect(visibleCardinalFaces(1)).toEqual({ frontLeft: "E", frontRight: "N" });
    expect(visibleCardinalFaces(2)).toEqual({ frontLeft: "N", frontRight: "W" });
    expect(visibleCardinalFaces(3)).toEqual({ frontLeft: "W", frontRight: "S" });
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
});
