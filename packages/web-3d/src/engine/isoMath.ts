/**
 * Deterministic isometric 3D projection, inverse picking, 4-angle discrete
 * rotation, painter's-algorithm depth sorting, and polygon hit-testing math.
 */

export type IsoRotation = 0 | 1 | 2 | 3;

export interface IsoPoint3D {
  gx: number;
  gy: number;
  gz: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface CameraTransform {
  centerX: number;
  centerY: number;
  zoom: number;
  rotation: IsoRotation;
  gridCols: number;
  gridRows: number;
  tileWidth?: number;
  tileHeight?: number;
  unitHeightPx?: number;
}

export const DEFAULT_TILE_WIDTH = 72;
export const DEFAULT_TILE_HEIGHT = 36;
export const DEFAULT_UNIT_HEIGHT_PX = 34;

export interface RotatedCoord {
  rx: number;
  ry: number;
  rotCols: number;
  rotRows: number;
}

/** Rotate world grid coordinates (gx, gy) by 90° increments clockwise. */
export function rotateGridCoord(
  gx: number,
  gy: number,
  gridCols: number,
  gridRows: number,
  rotation: IsoRotation,
): RotatedCoord {
  switch (rotation) {
    case 0:
      return { rx: gx, ry: gy, rotCols: gridCols, rotRows: gridRows };
    case 1:
      return { rx: gridRows - gy, ry: gx, rotCols: gridRows, rotRows: gridCols };
    case 2:
      return { rx: gridCols - gx, ry: gridRows - gy, rotCols: gridCols, rotRows: gridRows };
    case 3:
      return { rx: gy, ry: gridCols - gx, rotCols: gridRows, rotRows: gridCols };
  }
}

/** Inverse rotation from rotated space back into canonical (gx, gy) space. */
export function unrotateRotatedCoord(
  rx: number,
  ry: number,
  gridCols: number,
  gridRows: number,
  rotation: IsoRotation,
): { gx: number; gy: number } {
  switch (rotation) {
    case 0:
      return { gx: rx, gy: ry };
    case 1:
      return { gx: ry, gy: gridRows - rx };
    case 2:
      return { gx: gridCols - rx, gy: gridRows - ry };
    case 3:
      return { gx: gridCols - ry, gy: rx };
  }
}

/** Project a 3D grid-space coordinate onto 2D viewport screen pixels. */
export function projectIso(
  point: IsoPoint3D,
  camera: CameraTransform,
  viewportWidth: number,
  viewportHeight: number,
): ScreenPoint {
  const tw = (camera.tileWidth ?? DEFAULT_TILE_WIDTH) * camera.zoom;
  const th = (camera.tileHeight ?? DEFAULT_TILE_HEIGHT) * camera.zoom;
  const uh = (camera.unitHeightPx ?? DEFAULT_UNIT_HEIGHT_PX) * camera.zoom;

  const pRot = rotateGridCoord(point.gx, point.gy, camera.gridCols, camera.gridRows, camera.rotation);
  const cRot = rotateGridCoord(camera.centerX, camera.centerY, camera.gridCols, camera.gridRows, camera.rotation);

  const dx = pRot.rx - cRot.rx;
  const dy = pRot.ry - cRot.ry;

  return {
    x: viewportWidth * 0.5 + (dx - dy) * (tw * 0.5),
    y: viewportHeight * 0.5 + (dx + dy) * (th * 0.5) - point.gz * uh,
  };
}

/** Unproject screen pixels back to world (gx, gy) on a horizontal plane at gz = planeGz. */
export function unprojectIso(
  screenX: number,
  screenY: number,
  camera: CameraTransform,
  viewportWidth: number,
  viewportHeight: number,
  planeGz = 0,
): { gx: number; gy: number } {
  const tw = (camera.tileWidth ?? DEFAULT_TILE_WIDTH) * camera.zoom;
  const th = (camera.tileHeight ?? DEFAULT_TILE_HEIGHT) * camera.zoom;
  const uh = (camera.unitHeightPx ?? DEFAULT_UNIT_HEIGHT_PX) * camera.zoom;

  const cRot = rotateGridCoord(camera.centerX, camera.centerY, camera.gridCols, camera.gridRows, camera.rotation);

  const nx = (screenX - viewportWidth * 0.5) / (tw * 0.5);
  const ny = (screenY + planeGz * uh - viewportHeight * 0.5) / (th * 0.5);

  const dx = (nx + ny) * 0.5;
  const dy = (ny - nx) * 0.5;

  return unrotateRotatedCoord(
    cRot.rx + dx,
    cRot.ry + dy,
    camera.gridCols,
    camera.gridRows,
    camera.rotation,
  );
}

/** Compute painter's-algorithm depth key (lower renders first/behind, higher renders last/front). */
export function computeDepthKey(
  gx: number,
  gy: number,
  gz: number,
  gridCols: number,
  gridRows: number,
  rotation: IsoRotation,
  bias = 0,
): number {
  const { rx, ry } = rotateGridCoord(gx, gy, gridCols, gridRows, rotation);
  return (rx + ry) * 1000 + gz * 10 + bias;
}

/** Standard ray-casting test for whether screen point (px, py) lies inside polygon. */
export function pointInPolygon(px: number, py: number, polygon: readonly ScreenPoint[]): boolean {
  if (polygon.length < 3) {
    return false;
  }

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const pi = polygon[i]!;
    const pj = polygon[j]!;
    const intersects =
      (pi.y > py) !== (pj.y > py) &&
      px < ((pj.x - pi.x) * (py - pi.y)) / ((pj.y - pi.y) || 1e-12) + pi.x;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Pick the front-most hit target under cursor coordinates (highest depth key wins).
 */
export function pickTopHitTarget<T extends { hitPolygon: readonly ScreenPoint[]; depth: number }>(
  px: number,
  py: number,
  items: readonly T[],
): T | null {
  let best: T | null = null;
  for (const item of items) {
    if (!pointInPolygon(px, py, item.hitPolygon)) {
      continue;
    }
    if (!best || item.depth >= best.depth) {
      best = item;
    }
  }
  return best;
}

/** Compute screen-space bounding polygon (convex hull / 6-vertex hex silhouette) of a 3D axis-aligned prism. */
export function projectPrismSilhouette(
  gx: number,
  gy: number,
  gz: number,
  sizeX: number,
  sizeY: number,
  heightZ: number,
  camera: CameraTransform,
  viewportWidth: number,
  viewportHeight: number,
): ScreenPoint[] {
  const x0 = gx;
  const x1 = gx + sizeX;
  const y0 = gy;
  const y1 = gy + sizeY;
  const z0 = gz;
  const z1 = gz + heightZ;

  // All 8 corners projected, ordered around the exterior clockwise/CCW depending on rotation.
  // Selecting the extremal vertices in screen space guarantees exact hit-testing for any rotation.
  const corners: IsoPoint3D[] = [
    { gx: x0, gy: y0, gz: z0 },
    { gx: x1, gy: y0, gz: z0 },
    { gx: x1, gy: y1, gz: z0 },
    { gx: x0, gy: y1, gz: z0 },
    { gx: x0, gy: y0, gz: z1 },
    { gx: x1, gy: y0, gz: z1 },
    { gx: x1, gy: y1, gz: z1 },
    { gx: x0, gy: y1, gz: z1 },
  ];

  const pts = corners.map((c) => projectIso(c, camera, viewportWidth, viewportHeight));
  return convexHull(pts);
}

/** Andrew's monotone chain convex hull for compact silhouette hit polygons. */
export function convexHull(points: readonly ScreenPoint[]): ScreenPoint[] {
  if (points.length <= 3) {
    return [...points];
  }

  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const cross = (o: ScreenPoint, a: ScreenPoint, b: ScreenPoint) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: ScreenPoint[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: ScreenPoint[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}
