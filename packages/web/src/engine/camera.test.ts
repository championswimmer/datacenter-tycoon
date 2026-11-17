import { describe, expect, it } from "vitest";
import {
  createCameraState,
  fitCameraToGrid,
  focusCameraOnCell,
  MAX_CAMERA_ZOOM,
  MIN_CAMERA_ZOOM,
  panCameraByScreenDelta,
  rotateCameraCCW,
  rotateCameraCW,
  toggleCutaway,
  toCameraTransform,
  zoomCameraAtPoint,
} from "./camera.js";
import { projectIso } from "./isoMath.js";

describe("camera", () => {
  it("initializes centered on grid bounds and rotates cleanly across 4 steps", () => {
    let cam = createCameraState(12, 12);
    expect(cam.centerX).toBe(6);
    expect(cam.centerY).toBe(6);
    expect(cam.rotation).toBe(0);

    cam = rotateCameraCW(cam);
    expect(cam.rotation).toBe(1);
    cam = rotateCameraCW(cam);
    expect(cam.rotation).toBe(2);
    cam = rotateCameraCW(cam);
    expect(cam.rotation).toBe(3);
    cam = rotateCameraCW(cam);
    expect(cam.rotation).toBe(0);

    cam = rotateCameraCCW(cam);
    expect(cam.rotation).toBe(3);
  });

  it("clamps zoom bounds and keeps world point under cursor anchored when zooming", () => {
    const cam = createCameraState(12, 12, 1.0);
    const cursorX = 820;
    const cursorY = 260;
    const vw = 1200;
    const vh = 800;

    // Project a point under the cursor before zooming
    const beforeScreen = projectIso(
      { gx: 7.5, gy: 4.5, gz: 0 },
      toCameraTransform(cam, 12, 12),
      vw,
      vh,
    );

    const zoomed = zoomCameraAtPoint(cam, 1.65, beforeScreen.x, beforeScreen.y, vw, vh, 12, 12);
    const afterScreen = projectIso(
      { gx: 7.5, gy: 4.5, gz: 0 },
      toCameraTransform(zoomed, 12, 12),
      vw,
      vh,
    );
    expect(afterScreen.x).toBeCloseTo(beforeScreen.x, 6);
    expect(afterScreen.y).toBeCloseTo(beforeScreen.y, 6);

    const maxed = zoomCameraAtPoint(cam, 99, cursorX, cursorY, vw, vh, 12, 12);
    expect(maxed.zoom).toBe(MAX_CAMERA_ZOOM);
    const minned = zoomCameraAtPoint(cam, 0.01, cursorX, cursorY, vw, vh, 12, 12);
    expect(minned.zoom).toBe(MIN_CAMERA_ZOOM);
  });

  it("clamps panning near grid boundaries and toggles cutaway", () => {
    let cam = createCameraState(8, 4, 1);
    cam = panCameraByScreenDelta(cam, 5000, 5000, 1200, 800, 8, 4);
    expect(cam.centerX).toBeGreaterThanOrEqual(-1.5);
    expect(cam.centerY).toBeGreaterThanOrEqual(-1.5);

    cam = panCameraByScreenDelta(cam, -5000, -5000, 1200, 800, 8, 4);
    expect(cam.centerX).toBeLessThanOrEqual(9.5);
    expect(cam.centerY).toBeLessThanOrEqual(5.5);

    const toggled = toggleCutaway(cam);
    expect(toggled.cutaway).toBe(!cam.cutaway);
  });

  it("auto-fits grids into viewport and focuses on specific cells", () => {
    const cam = createCameraState(25, 8, 1);
    const fitted = fitCameraToGrid(cam, 25, 8, 1280, 720, 3);
    expect(fitted.zoom).toBeGreaterThanOrEqual(MIN_CAMERA_ZOOM);
    expect(fitted.zoom).toBeLessThan(1.0);
    expect(fitted.centerX).toBe(12.5);
    expect(fitted.centerY).toBe(4);

    const focused = focusCameraOnCell(fitted, 10, 3, 25, 8, 1.4);
    expect(focused.centerX).toBe(10);
    expect(focused.centerY).toBe(3);
    expect(focused.zoom).toBe(1.4);
  });

  it("centers fitted grids inside the area left by HUD insets", () => {
    const cam = createCameraState(12, 12);
    const insets = { left: 200, right: 300, top: 70, bottom: 110 };
    const fitted = fitCameraToGrid(cam, 12, 12, 1440, 900, 3.2, 0.92, insets);
    const projected = projectIso({ gx: 6, gy: 6, gz: 0 }, toCameraTransform(fitted, 12, 12), 1440, 900);
    expect(projected.x).toBeCloseTo(720 + (200 - 300) / 2, 0);
    expect(projected.y).toBeCloseTo(450 + (70 - 110) / 2, 0);
  });
});
