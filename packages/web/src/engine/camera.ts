import {
  DEFAULT_TILE_HEIGHT,
  DEFAULT_TILE_WIDTH,
  DEFAULT_UNIT_HEIGHT_PX,
  projectIso,
  unprojectIso,
  type CameraTransform,
  type IsoRotation,
} from "./isoMath.js";

export interface IsoCameraState {
  centerX: number;
  centerY: number;
  zoom: number;
  rotation: IsoRotation;
  cutaway: boolean;
}

export const MIN_CAMERA_ZOOM = 0.42;
export const MAX_CAMERA_ZOOM = 2.4;
export const DEFAULT_CAMERA_ZOOM = 1.0;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_CAMERA_ZOOM, Math.max(MIN_CAMERA_ZOOM, zoom));
}

function clampCenter(
  centerX: number,
  centerY: number,
  gridCols: number,
  gridRows: number,
): { centerX: number; centerY: number } {
  const margin = 1.5;
  return {
    centerX: Math.min(gridCols + margin, Math.max(-margin, centerX)),
    centerY: Math.min(gridRows + margin, Math.max(-margin, centerY)),
  };
}

export function createCameraState(
  gridCols: number,
  gridRows: number,
  initialZoom = DEFAULT_CAMERA_ZOOM,
): IsoCameraState {
  return {
    centerX: gridCols * 0.5,
    centerY: gridRows * 0.5,
    zoom: clampZoom(initialZoom),
    rotation: 0,
    cutaway: true,
  };
}

export function toCameraTransform(
  camera: IsoCameraState,
  gridCols: number,
  gridRows: number,
): CameraTransform {
  return {
    centerX: camera.centerX,
    centerY: camera.centerY,
    zoom: camera.zoom,
    rotation: camera.rotation,
    gridCols,
    gridRows,
    tileWidth: DEFAULT_TILE_WIDTH,
    tileHeight: DEFAULT_TILE_HEIGHT,
    unitHeightPx: DEFAULT_UNIT_HEIGHT_PX,
  };
}

/**
 * Pan camera by a screen-space pixel drag delta (cursor moves +dx, +dy so world
 * shifts with cursor and camera center shifts inversely).
 */
export function panCameraByScreenDelta(
  camera: IsoCameraState,
  deltaScreenX: number,
  deltaScreenY: number,
  viewportWidth: number,
  viewportHeight: number,
  gridCols: number,
  gridRows: number,
): IsoCameraState {
  const transform = toCameraTransform(camera, gridCols, gridRows);
  const cxScreen = viewportWidth * 0.5;
  const cyScreen = viewportHeight * 0.5;
  const nextWorldCenter = unprojectIso(
    cxScreen - deltaScreenX,
    cyScreen - deltaScreenY,
    transform,
    viewportWidth,
    viewportHeight,
    0,
  );
  const clamped = clampCenter(nextWorldCenter.gx, nextWorldCenter.gy, gridCols, gridRows);
  return {
    ...camera,
    ...clamped,
  };
}

/** Pan camera directly in grid units, accounting for current rotation if desired via screen axes or raw world axes. */
export function panCameraGrid(
  camera: IsoCameraState,
  dgx: number,
  dgy: number,
  gridCols: number,
  gridRows: number,
): IsoCameraState {
  const clamped = clampCenter(camera.centerX + dgx, camera.centerY + dgy, gridCols, gridRows);
  return {
    ...camera,
    ...clamped,
  };
}

/** Zoom camera while keeping the world coordinate under (cursorX, cursorY) anchored on screen. */
export function zoomCameraAtPoint(
  camera: IsoCameraState,
  nextZoomRaw: number,
  cursorX: number,
  cursorY: number,
  viewportWidth: number,
  viewportHeight: number,
  gridCols: number,
  gridRows: number,
): IsoCameraState {
  const nextZoom = clampZoom(nextZoomRaw);
  if (Math.abs(nextZoom - camera.zoom) < 1e-6) {
    return camera;
  }

  const prevTransform = toCameraTransform(camera, gridCols, gridRows);
  const worldUnderCursor = unprojectIso(cursorX, cursorY, prevTransform, viewportWidth, viewportHeight, 0);

  const probeCam: IsoCameraState = { ...camera, zoom: nextZoom };
  const probeTransform = toCameraTransform(probeCam, gridCols, gridRows);
  const projectedAfter = projectIso(
    { gx: worldUnderCursor.gx, gy: worldUnderCursor.gy, gz: 0 },
    probeTransform,
    viewportWidth,
    viewportHeight,
  );

  // Shift center so projectedAfter lines up with (cursorX, cursorY)
  const worldAtDesired = unprojectIso(
    viewportWidth * 0.5 + (projectedAfter.x - cursorX),
    viewportHeight * 0.5 + (projectedAfter.y - cursorY),
    probeTransform,
    viewportWidth,
    viewportHeight,
    0,
  );

  const clamped = clampCenter(worldAtDesired.gx, worldAtDesired.gy, gridCols, gridRows);
  return {
    ...probeCam,
    ...clamped,
  };
}

export function rotateCameraCW(camera: IsoCameraState): IsoCameraState {
  return {
    ...camera,
    rotation: ((camera.rotation + 1) % 4) as IsoRotation,
  };
}

export function rotateCameraCCW(camera: IsoCameraState): IsoCameraState {
  return {
    ...camera,
    rotation: ((camera.rotation + 3) % 4) as IsoRotation,
  };
}

export function toggleCutaway(camera: IsoCameraState): IsoCameraState {
  return {
    ...camera,
    cutaway: !camera.cutaway,
  };
}

export function focusCameraOnCell(
  camera: IsoCameraState,
  gx: number,
  gy: number,
  gridCols: number,
  gridRows: number,
  zoom?: number,
): IsoCameraState {
  const clamped = clampCenter(gx, gy, gridCols, gridRows);
  return {
    ...camera,
    ...clamped,
    zoom: zoom !== undefined ? clampZoom(zoom) : camera.zoom,
  };
}

/** Screen-space margins (px) occupied by HUD chrome that the fitted scene should avoid. */
export interface ViewportInsets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Auto-fit camera zoom and center so the entire 3D grid fits inside the viewport with breathing room.
 * When `insets` is given, the grid is fitted into (and centered within) the area left over after
 * subtracting those HUD margins, so panels never cover the scene.
 */
export function fitCameraToGrid(
  camera: IsoCameraState,
  gridCols: number,
  gridRows: number,
  viewportWidth: number,
  viewportHeight: number,
  maxHeightUnits = 3.2,
  paddingFactor = 0.8,
  insets?: ViewportInsets,
): IsoCameraState {
  const centerX = gridCols * 0.5;
  const centerY = gridRows * 0.5;
  const spanX = (gridCols + gridRows) * (DEFAULT_TILE_WIDTH * 0.5);
  const spanY =
    (gridCols + gridRows) * (DEFAULT_TILE_HEIGHT * 0.5) +
    maxHeightUnits * DEFAULT_UNIT_HEIGHT_PX;

  const insetW = insets ? Math.min(insets.left + insets.right, viewportWidth * 0.6) : 0;
  const insetH = insets ? Math.min(insets.top + insets.bottom, viewportHeight * 0.6) : 0;
  const usableW = Math.max(240, viewportWidth - insetW) * paddingFactor;
  const usableH = Math.max(180, viewportHeight - insetH) * paddingFactor;
  const zoom = clampZoom(Math.min(usableW / Math.max(spanX, 1), usableH / Math.max(spanY, 1)));

  const fitted: IsoCameraState = { ...camera, centerX, centerY, zoom };
  if (!insets || (insetW === 0 && insetH === 0)) return fitted;

  // Shift the camera so the grid center lands at the middle of the unobstructed area.
  const scaleW = insets.left + insets.right > 0 ? insetW / (insets.left + insets.right) : 0;
  const scaleH = insets.top + insets.bottom > 0 ? insetH / (insets.top + insets.bottom) : 0;
  const shiftX = ((insets.left - insets.right) * scaleW) / 2;
  const shiftY = ((insets.top - insets.bottom) * scaleH) / 2;
  const target = unprojectIso(
    viewportWidth * 0.5 - shiftX,
    viewportHeight * 0.5 - shiftY,
    toCameraTransform(fitted, gridCols, gridRows),
    viewportWidth,
    viewportHeight,
    0,
  );
  return { ...fitted, centerX: target.gx, centerY: target.gy };
}
