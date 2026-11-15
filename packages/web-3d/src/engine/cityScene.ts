import type {
  Datacenter,
  DatacenterId,
  DatacenterInfrastructureView,
  DatacenterResourceUsage,
  Region,
  RegionFabricView,
  RegionId,
} from "@datacenter-tycoon/game-logic";
import { toCameraTransform, type IsoCameraState } from "./camera.js";
import {
  computeDepthKey,
  projectIso,
  projectPrismSilhouette,
  type CameraTransform,
  type IsoPoint3D,
  type ScreenPoint,
} from "./isoMath.js";
import {
  bilerpQuad,
  drawFaceRect,
  drawIsoBadge,
  drawIsoBox,
  drawIsoConduit,
  drawIsoCylinder,
  drawIsoTile,
  drawIsoWindowGrid,
  mixHex,
} from "./primitives3d.js";
import type { InfoOverlayMode } from "./rackModels3d.js";

export const CITY_GRID_SIZE = 12;

export type CityLandmarkId = "power_substation" | "fiber_exchange" | "workforce_campus";

export type CityHitTarget =
  | {
      kind: "datacenter";
      dcId: DatacenterId;
      regionId: RegionId;
      gx: number;
      gy: number;
      hitPolygon: ScreenPoint[];
      depth: number;
    }
  | {
      kind: "vacant_lot";
      lotIndex: number;
      regionId: RegionId;
      gx: number;
      gy: number;
      hitPolygon: ScreenPoint[];
      depth: number;
    }
  | {
      kind: "landmark";
      landmarkId: CityLandmarkId;
      label: string;
      gx: number;
      gy: number;
      hitPolygon: ScreenPoint[];
      depth: number;
    };

export interface CityDatacenterSummary {
  datacenter: Datacenter;
  infrastructure: DatacenterInfrastructureView;
  usage: DatacenterResourceUsage;
  activeContractCount: number;
  repairingRackCount: number;
  fabricConnected: boolean;
}

export interface CitySceneInput {
  region: Region;
  datacenters: readonly CityDatacenterSummary[];
  regionFabric?: RegionFabricView;
  camera: IsoCameraState;
  overlayMode: InfoOverlayMode;
  selectedDcId: DatacenterId | null;
  hoveredTarget: CityHitTarget | null;
  buildDcToolActive: boolean;
  timeSec: number;
}

interface PlotAnchor {
  lotIndex: number;
  tileX: number;
  tileY: number;
  conduitWaypoints: readonly IsoPoint3D[];
}

interface LandmarkAnchor {
  landmarkId: CityLandmarkId;
  label: string;
  tileX: number;
  tileY: number;
  heightUnits: number;
}

interface DepthRenderItem {
  depth: number;
  draw: () => void;
}

interface PendingBadge {
  depth: number;
  anchor: ScreenPoint;
  label: string;
  bg?: string;
  border: string;
  textColor: string;
  fontSizePx?: number;
}

const ROAD_INDICES = new Set<number>([3, 8]);

const LANDMARK_ANCHORS: readonly LandmarkAnchor[] = [
  {
    landmarkId: "power_substation",
    label: "Municipal Power Substation",
    tileX: 0,
    tileY: 0,
    heightUnits: 1.15,
  },
  {
    landmarkId: "fiber_exchange",
    label: "Regional Fiber Exchange",
    tileX: 5,
    tileY: 4,
    heightUnits: 2.65,
  },
  {
    landmarkId: "workforce_campus",
    label: "Tech Workforce Campus",
    tileX: 9,
    tileY: 0,
    heightUnits: 1.45,
  },
];

const DC_CAMPUS_PLOTS: readonly PlotAnchor[] = [
  {
    lotIndex: 0,
    tileX: 4,
    tileY: 1,
    conduitWaypoints: [
      { gx: 6.0, gy: 5.0, gz: 0.05 },
      { gx: 6.0, gy: 3.5, gz: 0.05 },
      { gx: 5.0, gy: 3.5, gz: 0.05 },
      { gx: 5.0, gy: 2.75, gz: 0.05 },
      { gx: 5.0, gy: 2.55, gz: 0.35 },
    ],
  },
  {
    lotIndex: 1,
    tileX: 1,
    tileY: 4,
    conduitWaypoints: [
      { gx: 6.0, gy: 5.0, gz: 0.05 },
      { gx: 6.0, gy: 3.5, gz: 0.05 },
      { gx: 3.5, gy: 3.5, gz: 0.05 },
      { gx: 3.5, gy: 5.0, gz: 0.05 },
      { gx: 2.75, gy: 5.0, gz: 0.05 },
      { gx: 2.55, gy: 5.0, gz: 0.35 },
    ],
  },
  {
    lotIndex: 2,
    tileX: 9,
    tileY: 4,
    conduitWaypoints: [
      { gx: 6.0, gy: 5.0, gz: 0.05 },
      { gx: 6.0, gy: 3.5, gz: 0.05 },
      { gx: 8.5, gy: 3.5, gz: 0.05 },
      { gx: 8.5, gy: 5.0, gz: 0.05 },
      { gx: 9.25, gy: 5.0, gz: 0.05 },
      { gx: 9.45, gy: 5.0, gz: 0.35 },
    ],
  },
  {
    lotIndex: 3,
    tileX: 1,
    tileY: 9,
    conduitWaypoints: [
      { gx: 6.0, gy: 5.0, gz: 0.05 },
      { gx: 6.0, gy: 3.5, gz: 0.05 },
      { gx: 3.5, gy: 3.5, gz: 0.05 },
      { gx: 3.5, gy: 10.0, gz: 0.05 },
      { gx: 2.75, gy: 10.0, gz: 0.05 },
      { gx: 2.55, gy: 10.0, gz: 0.35 },
    ],
  },
  {
    lotIndex: 4,
    tileX: 5,
    tileY: 9,
    conduitWaypoints: [
      { gx: 6.0, gy: 5.0, gz: 0.05 },
      { gx: 6.0, gy: 3.5, gz: 0.05 },
      { gx: 8.5, gy: 3.5, gz: 0.05 },
      { gx: 8.5, gy: 8.5, gz: 0.05 },
      { gx: 6.0, gy: 8.5, gz: 0.05 },
      { gx: 6.0, gy: 9.25, gz: 0.05 },
      { gx: 6.0, gy: 9.45, gz: 0.35 },
    ],
  },
  {
    lotIndex: 5,
    tileX: 9,
    tileY: 9,
    conduitWaypoints: [
      { gx: 6.0, gy: 5.0, gz: 0.05 },
      { gx: 6.0, gy: 3.5, gz: 0.05 },
      { gx: 8.5, gy: 3.5, gz: 0.05 },
      { gx: 8.5, gy: 10.0, gz: 0.05 },
      { gx: 9.25, gy: 10.0, gz: 0.05 },
      { gx: 9.45, gy: 10.0, gz: 0.35 },
    ],
  },
];

const CANAL_TILES = new Set<string>(["4,6", "5,6", "6,6", "7,6"]);

const PARK_TILES = new Set<string>([
  "2,2",
  "6,2",
  "11,2",
  "4,5",
  "7,5",
  "0,6",
  "11,6",
  "4,7",
  "5,7",
  "6,7",
  "7,7",
  "2,11",
  "4,11",
  "7,11",
  "11,11",
]);

function cellKey(gx: number, gy: number): string {
  return `${gx},${gy}`;
}

/** Deterministic FNV-1a 32-bit string hash for region-seeded procedural city blocks. */
function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic unit float [0, 1) from integer seed + tile coordinates. */
function seededFloat(regionSeed: number, gx: number, gy: number, salt: number): number {
  let x = (regionSeed ^ Math.imul(gx + 17, 0x9e3779b1) ^ Math.imul(gy + 31, 0x85ebca6b) ^ Math.imul(salt + 7, 0xc2b2ae35)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  x ^= x >>> 16;
  return x / 0x100000000;
}

function isRoadTile(gx: number, gy: number): boolean {
  return ROAD_INDICES.has(gx) || ROAD_INDICES.has(gy);
}

function isTileIn2x2(gx: number, gy: number, ox: number, oy: number): boolean {
  return gx >= ox && gx <= ox + 1 && gy >= oy && gy <= oy + 1;
}

function isReservedCell(gx: number, gy: number): boolean {
  if (isRoadTile(gx, gy)) return true;
  if (CANAL_TILES.has(cellKey(gx, gy)) || PARK_TILES.has(cellKey(gx, gy))) return true;
  for (const lm of LANDMARK_ANCHORS) {
    if (isTileIn2x2(gx, gy, lm.tileX, lm.tileY)) return true;
  }
  for (const plot of DC_CAMPUS_PLOTS) {
    if (isTileIn2x2(gx, gy, plot.tileX, plot.tileY)) return true;
  }
  return false;
}

function drawDistrictBackdrop(
  ctx: CanvasRenderingContext2D,
  viewportWidth: number,
  viewportHeight: number,
  overlayMode: InfoOverlayMode,
): void {
  const grad = ctx.createLinearGradient(0, 0, 0, viewportHeight);
  if (overlayMode === "standard") {
    grad.addColorStop(0, "#050a14");
    grad.addColorStop(0.55, "#091322");
    grad.addColorStop(1, "#0b192c");
  } else {
    grad.addColorStop(0, "#040811");
    grad.addColorStop(1, "#08101c");
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);
}

function drawRoadTile(
  ctx: CanvasRenderingContext2D,
  transform: CameraTransform,
  vw: number,
  vh: number,
  gx: number,
  gy: number,
  overlayMode: InfoOverlayMode,
): void {
  const isV = ROAD_INDICES.has(gx);
  const isH = ROAD_INDICES.has(gy);
  const isIntersection = isV && isH;
  const asphalt = overlayMode === "standard" ? "#192231" : "#111824";
  const curb = overlayMode === "standard" ? "#29374c" : "#1c2636";
  const dashColor = overlayMode === "standard" ? "rgba(250, 204, 21, 0.72)" : "rgba(148, 163, 184, 0.35)";
  const crosswalkColor = overlayMode === "standard" ? "rgba(226, 232, 240, 0.55)" : "rgba(148, 163, 184, 0.25)";

  drawIsoTile(ctx, transform, vw, vh, {
    gx,
    gy,
    gz: 0,
    sx: 1,
    sy: 1,
    fill: asphalt,
    stroke: curb,
    lineWidth: 0.8,
  });

  if (isIntersection) {
    // Crisp pedestrian crosswalk stripes on intersection approaches
    for (let s = 0; s < 3; s++) {
      const offset = 0.2 + s * 0.24;
      drawIsoTile(ctx, transform, vw, vh, {
        gx: gx + offset,
        gy: gy + 0.08,
        gz: 0.005,
        sx: 0.12,
        sy: 0.16,
        fill: crosswalkColor,
      });
      drawIsoTile(ctx, transform, vw, vh, {
        gx: gx + 0.08,
        gy: gy + offset,
        gz: 0.005,
        sx: 0.16,
        sy: 0.12,
        fill: crosswalkColor,
      });
    }
    return;
  }

  // Painted center lane dashes along avenue axis
  if (isV) {
    drawIsoTile(ctx, transform, vw, vh, {
      gx: gx + 0.47,
      gy: gy + 0.15,
      gz: 0.005,
      sx: 0.06,
      sy: 0.28,
      fill: dashColor,
    });
    drawIsoTile(ctx, transform, vw, vh, {
      gx: gx + 0.47,
      gy: gy + 0.58,
      gz: 0.005,
      sx: 0.06,
      sy: 0.28,
      fill: dashColor,
    });
  } else if (isH) {
    drawIsoTile(ctx, transform, vw, vh, {
      gx: gx + 0.15,
      gy: gy + 0.47,
      gz: 0.005,
      sx: 0.28,
      sy: 0.06,
      fill: dashColor,
    });
    drawIsoTile(ctx, transform, vw, vh, {
      gx: gx + 0.58,
      gy: gy + 0.47,
      gz: 0.005,
      sx: 0.28,
      sy: 0.06,
      fill: dashColor,
    });
  }
}

function drawWaterCanalTile(
  ctx: CanvasRenderingContext2D,
  transform: CameraTransform,
  vw: number,
  vh: number,
  gx: number,
  gy: number,
  timeSec: number,
  overlayMode: InfoOverlayMode,
): void {
  const wave = 0.5 + 0.5 * Math.sin(timeSec * 2.1 + gx * 0.9 + gy * 0.4);
  const rimColor = overlayMode === "standard" ? "#243447" : "#16202c";
  const waterColor =
    overlayMode === "standard"
      ? mixHex("#0b4f6c", "#0891b2", wave * 0.55)
      : mixHex("#0b2938", "#0e4d64", wave * 0.35);

  drawIsoTile(ctx, transform, vw, vh, {
    gx,
    gy,
    gz: 0,
    sx: 1,
    sy: 1,
    fill: rimColor,
    stroke: "#334155",
    lineWidth: 0.7,
  });

  drawIsoTile(ctx, transform, vw, vh, {
    gx: gx + 0.04,
    gy: gy + 0.12,
    gz: 0.004,
    sx: 0.92,
    sy: 0.76,
    fill: waterColor,
    stroke: overlayMode === "standard" ? "rgba(56, 189, 248, 0.45)" : "rgba(56, 189, 248, 0.2)",
    lineWidth: 0.8,
  });

  // Subtle water shimmer ripple
  const rippleX = gx + 0.15 + ((timeSec * 0.25 + gx * 0.31) % 0.45);
  drawIsoTile(ctx, transform, vw, vh, {
    gx: rippleX,
    gy: gy + 0.45,
    gz: 0.008,
    sx: 0.28,
    sy: 0.06,
    fill: "rgba(186, 230, 253, 0.42)",
  });
}

function drawParkPlazaTile(
  ctx: CanvasRenderingContext2D,
  transform: CameraTransform,
  vw: number,
  vh: number,
  gx: number,
  gy: number,
  overlayMode: InfoOverlayMode,
): void {
  const turf = overlayMode === "standard" ? "#153d2e" : "#112420";
  const walkway = overlayMode === "standard" ? "#263446" : "#182230";

  drawIsoTile(ctx, transform, vw, vh, {
    gx,
    gy,
    gz: 0,
    sx: 1,
    sy: 1,
    fill: walkway,
    stroke: "rgba(148, 163, 184, 0.16)",
    lineWidth: 0.6,
  });

  drawIsoTile(ctx, transform, vw, vh, {
    gx: gx + 0.1,
    gy: gy + 0.1,
    gz: 0.005,
    sx: 0.8,
    sy: 0.8,
    fill: turf,
    stroke: overlayMode === "standard" ? "rgba(52, 211, 153, 0.28)" : "rgba(52, 211, 153, 0.12)",
    lineWidth: 0.7,
  });
}

function drawStylizedTree(
  ctx: CanvasRenderingContext2D,
  transform: CameraTransform,
  vw: number,
  vh: number,
  gx: number,
  gy: number,
  scale: number,
  overlayMode: InfoOverlayMode,
): void {
  const trunkTop = overlayMode === "standard" ? "#5c4033" : "#2f2420";
  const trunkSide = overlayMode === "standard" ? "#3e2723" : "#201816";
  const canopyTop = overlayMode === "standard" ? "#22c55e" : "#1b4d38";
  const canopyLeft = overlayMode === "standard" ? "#15803d" : "#133627";
  const canopyRight = overlayMode === "standard" ? "#16a34a" : "#174230";

  drawIsoCylinder(ctx, transform, vw, vh, {
    gx,
    gy,
    gz: 0,
    radius: 0.06 * scale,
    height: 0.22 * scale,
    topColor: trunkTop,
    sideLeftColor: trunkSide,
    sideRightColor: trunkTop,
  });

  drawIsoCylinder(ctx, transform, vw, vh, {
    gx,
    gy,
    gz: 0.18 * scale,
    radius: 0.22 * scale,
    height: 0.26 * scale,
    topColor: canopyTop,
    sideLeftColor: canopyLeft,
    sideRightColor: canopyRight,
    strokeColor: overlayMode === "standard" ? "rgba(134, 239, 172, 0.32)" : undefined,
  });

  drawIsoCylinder(ctx, transform, vw, vh, {
    gx,
    gy,
    gz: 0.4 * scale,
    radius: 0.14 * scale,
    height: 0.18 * scale,
    topColor: mixHex(canopyTop, "#bbf7d0", 0.25),
    sideLeftColor: canopyLeft,
    sideRightColor: canopyRight,
  });
}

function drawSkylineBuilding(
  ctx: CanvasRenderingContext2D,
  transform: CameraTransform,
  vw: number,
  vh: number,
  gx: number,
  gy: number,
  regionSeed: number,
  overlayMode: InfoOverlayMode,
  timeSec: number,
): void {
  const r0 = seededFloat(regionSeed, gx, gy, 1);
  const r1 = seededFloat(regionSeed, gx, gy, 2);
  const r2 = seededFloat(regionSeed, gx, gy, 3);
  const r3 = seededFloat(regionSeed, gx, gy, 4);

  // Keep buildings near center/south edges moderately compact so landmarks/lots stay legible
  const isDowntown = gx >= 4 && gx <= 7 && gy >= 4 && gy <= 7;
  const height = isDowntown ? 1.15 + r0 * 0.7 : 0.55 + r0 * 1.15;
  const margin = 0.12 + r1 * 0.06;
  const sx = 1 - margin * 2;
  const sy = 1 - margin * 2;

  const archetype = Math.floor(r2 * 3); // 0: glass tower, 1: charcoal-amber midrise, 2: tech loft
  const dimmed = overlayMode !== "standard";

  let topColor = "#24354c";
  let leftColor = "#131d2d";
  let rightColor = "#1b293d";
  let winOn = "#7dd3fc";
  let winWarm = "#fde68a";

  if (archetype === 1) {
    topColor = "#2e2c36";
    leftColor = "#1a1922";
    rightColor = "#23222d";
    winOn = "#fcd34d";
  } else if (archetype === 2) {
    topColor = "#1f323c";
    leftColor = "#121f27";
    rightColor = "#182832";
    winOn = "#2dd4bf";
  }

  if (dimmed) {
    topColor = "#182230";
    leftColor = "#0d141d";
    rightColor = "#121b27";
    winOn = "rgba(100, 116, 139, 0.25)";
    winWarm = "rgba(100, 116, 139, 0.2)";
  }

  const box = drawIsoBox(ctx, transform, vw, vh, {
    gx: gx + margin,
    gy: gy + margin,
    gz: 0,
    sx,
    sy,
    hz: height,
    topColor,
    leftColor,
    rightColor,
    strokeColor: dimmed ? "rgba(148, 163, 184, 0.14)" : "rgba(148, 163, 184, 0.26)",
    lineWidth: 0.85,
  });

  const rows = Math.max(2, Math.round(height * 4));
  const cols = archetype === 0 ? 3 : 2;
  const drawWins = (quad: readonly [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint], faceSalt: number) => {
    drawIsoWindowGrid(
      ctx,
      quad,
      rows,
      cols,
      (row, col) => {
        const lit = seededFloat(regionSeed, gx * 11 + row, gy * 13 + col, faceSalt);
        if (lit < 0.34) return "rgba(15, 23, 42, 0.72)";
        if (archetype === 1 && lit > 0.78) return winWarm;
        // Subtle window shimmer when standard mode
        if (!dimmed && lit > 0.92) {
          const blink = Math.sin(timeSec * 1.4 + row + col + gx) > 0;
          return blink ? "#ffffff" : winOn;
        }
        return winOn;
      },
      0.16,
      0.14,
    );
  };

  drawWins(box.frontLeftQuad, 11);
  drawWins(box.frontRightQuad, 23);

  // Rooftop mechanical crown or water tank
  if (r3 > 0.45) {
    drawIsoBox(ctx, transform, vw, vh, {
      gx: gx + margin + 0.16,
      gy: gy + margin + 0.16,
      gz: height,
      sx: sx - 0.32,
      sy: sy - 0.32,
      hz: 0.14,
      topColor: mixHex(topColor, "#94a3b8", 0.2),
      leftColor,
      rightColor,
      strokeColor: dimmed ? undefined : "rgba(148, 163, 184, 0.22)",
    });
  } else if (r3 < 0.24 && !dimmed) {
    drawIsoCylinder(ctx, transform, vw, vh, {
      gx: gx + 0.5,
      gy: gy + 0.5,
      gz: height,
      radius: 0.11,
      height: 0.18,
      topColor: "#94a3b8",
      sideLeftColor: "#334155",
      sideRightColor: "#64748b",
    });
  }
}

function drawVehicle(
  ctx: CanvasRenderingContext2D,
  transform: CameraTransform,
  vw: number,
  vh: number,
  gx: number,
  gy: number,
  axis: "x" | "y",
  color: string,
  overlayMode: InfoOverlayMode,
): void {
  const sx = axis === "x" ? 0.3 : 0.15;
  const sy = axis === "x" ? 0.15 : 0.3;
  const muted = overlayMode !== "standard";
  const topColor = muted ? "#475569" : mixHex(color, "#ffffff", 0.22);
  const leftColor = muted ? "#1e293b" : mixHex(color, "#0f172a", 0.42);
  const rightColor = muted ? "#334155" : mixHex(color, "#0f172a", 0.2);

  drawIsoBox(ctx, transform, vw, vh, {
    gx: gx - sx * 0.5,
    gy: gy - sy * 0.5,
    gz: 0.02,
    sx,
    sy,
    hz: 0.12,
    topColor,
    leftColor,
    rightColor,
    strokeColor: muted ? undefined : "rgba(255, 255, 255, 0.28)",
    lineWidth: 0.7,
  });
}

function resolvePowerSubstationColor(region: Region, overlayMode: InfoOverlayMode): string {
  const ratio = region.totalPowerAvailable > 0 ? region.powerUsed / region.totalPowerAvailable : 0;
  if (overlayMode === "power") {
    return mixHex("#0ea5e9", ratio > 0.8 ? "#ff4d6d" : "#ffb703", Math.min(1, ratio));
  }
  return ratio > 0.85 ? "#ff4d6d" : "#ffb703";
}

function drawPowerSubstation(
  ctx: CanvasRenderingContext2D,
  transform: CameraTransform,
  vw: number,
  vh: number,
  anchor: LandmarkAnchor,
  input: CitySceneInput,
  hovered: boolean,
): { hitPolygon: ScreenPoint[]; roofAnchor: ScreenPoint; badgeText: string; accent: string } {
  const { tileX, tileY } = anchor;
  const accent = resolvePowerSubstationColor(input.region, input.overlayMode);
  const pulse = 0.5 + 0.5 * Math.sin(input.timeSec * 3.1);

  // Industrial pad + pulsing glow ring
  drawIsoTile(ctx, transform, vw, vh, {
    gx: tileX + 0.08,
    gy: tileY + 0.08,
    gz: 0.01,
    sx: 1.84,
    sy: 1.84,
    fill: "#1a2332",
    stroke: hovered ? "#ffffff" : accent,
    lineWidth: hovered ? 2.1 : 1.4,
    glowColor: accent,
    glowBlur: hovered ? 16 : 6 + pulse * 6,
  });

  // Control building
  const controlBox = drawIsoBox(ctx, transform, vw, vh, {
    gx: tileX + 0.22,
    gy: tileY + 0.22,
    gz: 0.02,
    sx: 0.7,
    sy: 1.15,
    hz: 0.68,
    topColor: "#334155",
    leftColor: "#1b2432",
    rightColor: "#253144",
    strokeColor: accent,
    lineWidth: 1,
    topHighlight: mixHex(accent, "#ffffff", 0.35),
  });
  drawIsoWindowGrid(ctx, controlBox.frontLeftQuad, 2, 3, (r) => (r === 0 ? accent : "rgba(15, 23, 42, 0.7)"));

  // Three cylindrical HV transformer capacitors
  const capacitorCoords: readonly [number, number][] = [
    [tileX + 1.35, tileY + 0.45],
    [tileX + 1.35, tileY + 0.95],
    [tileX + 1.35, tileY + 1.45],
  ];
  for (const [cx, cy] of capacitorCoords) {
    drawIsoCylinder(ctx, transform, vw, vh, {
      gx: cx,
      gy: cy,
      gz: 0.02,
      radius: 0.19,
      height: 0.82,
      topColor: accent,
      sideLeftColor: "#1f2937",
      sideRightColor: "#475569",
      strokeColor: "#e2e8f0",
    });
  }

  // High-voltage busbar connecting control house to capacitors
  drawIsoConduit(
    ctx,
    transform,
    vw,
    vh,
    [
      { gx: tileX + 0.92, gy: tileY + 0.45, gz: 0.66 },
      { gx: tileX + 1.35, gy: tileY + 0.45, gz: 0.84 },
      { gx: tileX + 1.35, gy: tileY + 1.45, gz: 0.84 },
    ],
    {
      color: accent,
      widthPx: 2.2,
      glowColor: accent,
      glowBlur: 8,
    },
  );

  const hitPolygon = projectPrismSilhouette(
    tileX + 0.08,
    tileY + 0.08,
    0,
    1.84,
    1.84,
    anchor.heightUnits,
    transform,
    vw,
    vh,
  );
  const roofAnchor = projectIso(
    { gx: tileX + 1, gy: tileY + 1, gz: 1.2 },
    transform,
    vw,
    vh,
  );

  return {
    hitPolygon,
    roofAnchor,
    badgeText: `PWR ${input.region.powerUsed}/${input.region.totalPowerAvailable} kW`,
    accent,
  };
}

function drawFiberExchange(
  ctx: CanvasRenderingContext2D,
  transform: CameraTransform,
  vw: number,
  vh: number,
  anchor: LandmarkAnchor,
  input: CitySceneInput,
  connectedCount: number,
  hovered: boolean,
): { hitPolygon: ScreenPoint[]; roofAnchor: ScreenPoint; badgeText: string; accent: string } {
  const { tileX, tileY } = anchor;
  const fabricActive = connectedCount > 0 || Boolean(input.regionFabric?.active);
  const accent = fabricActive ? "#e879f9" : "#00f5d4";
  const pulse = 0.5 + 0.5 * Math.sin(input.timeSec * 3.6);

  // Civic optical plaza base
  drawIsoTile(ctx, transform, vw, vh, {
    gx: tileX + 0.08,
    gy: tileY + 0.08,
    gz: 0.01,
    sx: 1.84,
    sy: 1.84,
    fill: "#172233",
    stroke: hovered ? "#ffffff" : accent,
    lineWidth: hovered ? 2.1 : 1.5,
    glowColor: accent,
    glowBlur: hovered ? 18 : 8 + pulse * 8,
  });

  // Stepped telecom switching hall
  const hall = drawIsoBox(ctx, transform, vw, vh, {
    gx: tileX + 0.34,
    gy: tileY + 0.34,
    gz: 0.02,
    sx: 1.32,
    sy: 1.32,
    hz: 0.92,
    topColor: mixHex("#1e293b", accent, 0.28),
    leftColor: "#0f172a",
    rightColor: "#17253b",
    strokeColor: accent,
    lineWidth: 1.1,
    topHighlight: mixHex(accent, "#ffffff", 0.45),
  });
  drawIsoWindowGrid(
    ctx,
    hall.frontLeftQuad,
    3,
    4,
    (r, c) => ((r + c + Math.floor(input.timeSec * 3)) % 2 === 0 ? accent : "#38bdf8"),
  );
  drawIsoWindowGrid(
    ctx,
    hall.frontRightQuad,
    3,
    4,
    (r, c) => ((r + c + Math.floor(input.timeSec * 3)) % 2 === 1 ? accent : "#38bdf8"),
  );

  // Upper stepped crown
  drawIsoBox(ctx, transform, vw, vh, {
    gx: tileX + 0.62,
    gy: tileY + 0.62,
    gz: 0.94,
    sx: 0.76,
    sy: 0.76,
    hz: 0.44,
    topColor: mixHex("#273549", accent, 0.4),
    leftColor: "#141f30",
    rightColor: "#1c2b42",
    strokeColor: accent,
  });

  // Comm spire & receiver dish
  drawIsoCylinder(ctx, transform, vw, vh, {
    gx: tileX + 1.0,
    gy: tileY + 1.0,
    gz: 1.38,
    radius: 0.12,
    height: 1.15,
    topColor: "#ffffff",
    sideLeftColor: "#334155",
    sideRightColor: accent,
    strokeColor: "#e2e8f0",
  });

  drawIsoCylinder(ctx, transform, vw, vh, {
    gx: tileX + 1.0,
    gy: tileY + 1.0,
    gz: 1.95,
    radius: 0.34,
    height: 0.08,
    topColor: mixHex("#0f172a", accent, 0.45),
    sideLeftColor: accent,
    sideRightColor: "#00f5d4",
    strokeColor: "#ffffff",
  });

  // Spire tip beacon
  const tipPt = projectIso(
    { gx: tileX + 1.0, gy: tileY + 1.0, gz: 2.58 },
    transform,
    vw,
    vh,
  );
  ctx.save();
  ctx.fillStyle = accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 14 * transform.zoom;
  ctx.beginPath();
  ctx.arc(tipPt.x, tipPt.y, (3.2 + pulse * 1.4) * Math.max(0.7, transform.zoom), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const hitPolygon = projectPrismSilhouette(
    tileX + 0.08,
    tileY + 0.08,
    0,
    1.84,
    1.84,
    anchor.heightUnits,
    transform,
    vw,
    vh,
  );
  const roofAnchor = projectIso(
    { gx: tileX + 1.0, gy: tileY + 1.0, gz: 2.7 },
    transform,
    vw,
    vh,
  );

  const badgeText = fabricActive
    ? `FIBER FABRIC · ${connectedCount} LINKED`
    : input.regionFabric && input.regionFabric.eligibleDcIds.length > 0
      ? `FIBER READY · ${input.regionFabric.eligibleDcIds.length} ELIGIBLE`
      : "FIBER EXCHANGE";

  return {
    hitPolygon,
    roofAnchor,
    badgeText,
    accent,
  };
}

function drawWorkforceCampus(
  ctx: CanvasRenderingContext2D,
  transform: CameraTransform,
  vw: number,
  vh: number,
  anchor: LandmarkAnchor,
  input: CitySceneInput,
  hovered: boolean,
): { hitPolygon: ScreenPoint[]; roofAnchor: ScreenPoint; badgeText: string; accent: string } {
  const { tileX, tileY } = anchor;
  const ratio = input.region.totalStaffAvailable > 0 ? input.region.staffUsed / input.region.totalStaffAvailable : 0;
  const accent = ratio > 0.85 ? "#ffb703" : "#00f5a0";

  // Campus courtyard slab
  drawIsoTile(ctx, transform, vw, vh, {
    gx: tileX + 0.08,
    gy: tileY + 0.08,
    gz: 0.01,
    sx: 1.84,
    sy: 1.84,
    fill: "#173028",
    stroke: hovered ? "#ffffff" : accent,
    lineWidth: hovered ? 2.1 : 1.3,
    glowColor: hovered ? accent : undefined,
    glowBlur: hovered ? 14 : 0,
  });

  // Main stepped office tower
  const mainWing = drawIsoBox(ctx, transform, vw, vh, {
    gx: tileX + 0.2,
    gy: tileY + 0.2,
    gz: 0.02,
    sx: 0.92,
    sy: 1.36,
    hz: 1.25,
    topColor: "#24404d",
    leftColor: "#142732",
    rightColor: "#1b3340",
    strokeColor: accent,
    lineWidth: 1,
    topHighlight: mixHex(accent, "#ffffff", 0.35),
  });
  drawIsoWindowGrid(ctx, mainWing.frontLeftQuad, 4, 3, (r) => (r % 2 === 0 ? "#6ee7b7" : "#38bdf8"));
  drawIsoWindowGrid(ctx, mainWing.frontRightQuad, 4, 2, () => "#6ee7b7");

  // Secondary lower stepped glass wing
  const eastWing = drawIsoBox(ctx, transform, vw, vh, {
    gx: tileX + 1.08,
    gy: tileY + 0.45,
    gz: 0.02,
    sx: 0.72,
    sy: 1.15,
    hz: 0.82,
    topColor: "#284c57",
    leftColor: "#152b35",
    rightColor: "#1e3a46",
    strokeColor: accent,
    lineWidth: 0.9,
  });
  drawIsoWindowGrid(ctx, eastWing.frontLeftQuad, 3, 2, () => "#a7f3d0");
  drawIsoWindowGrid(ctx, eastWing.frontRightQuad, 3, 2, () => "#67e8f9");

  const hitPolygon = projectPrismSilhouette(
    tileX + 0.08,
    tileY + 0.08,
    0,
    1.84,
    1.84,
    anchor.heightUnits,
    transform,
    vw,
    vh,
  );
  const roofAnchor = projectIso(
    { gx: tileX + 0.9, gy: tileY + 0.9, gz: 1.42 },
    transform,
    vw,
    vh,
  );

  return {
    hitPolygon,
    roofAnchor,
    badgeText: `STAFF ${input.region.staffUsed}/${input.region.totalStaffAvailable}`,
    accent,
  };
}

function resolveDcOverlayStyle(
  summary: CityDatacenterSummary,
  overlayMode: InfoOverlayMode,
  isFabricConnected: boolean,
): {
  tintColor: string;
  accent: string;
  badgeDetail: string;
} {
  const { datacenter, infrastructure, usage, activeContractCount, repairingRackCount } = summary;
  const eff = infrastructure.effective;
  const totalSlots = datacenter.spec.rows * datacenter.spec.positionsPerRow;

  switch (overlayMode) {
    case "standard": {
      const repairTag = repairingRackCount > 0 ? ` · !${repairingRackCount} FIX` : "";
      const contractTag = activeContractCount > 0 ? ` · ${activeContractCount}C` : "";
      const baseAccent =
        repairingRackCount > 0
          ? "#ffb703"
          : isFabricConnected
            ? "#e879f9"
            : "#00f5d4";
      return {
        tintColor: baseAccent,
        accent: baseAccent,
        badgeDetail: `${usage.slotsUsed}/${totalSlots}R${contractTag}${repairTag}`,
      };
    }

    case "power": {
      const ratio = eff.rackPowerCapacityKw > 0 ? Math.min(1, usage.powerKw / eff.rackPowerCapacityKw) : 0;
      const color = mixHex("#0ea5e9", ratio > 0.78 ? "#ff4d6d" : "#ffb703", ratio);
      const genTag = eff.onsiteGenerationCapacityKw > 0 ? ` +${Math.round(eff.onsiteGenerationCapacityKw)}G` : "";
      return {
        tintColor: color,
        accent: color,
        badgeDetail: `${Math.round(usage.powerKw)}/${Math.round(eff.rackPowerCapacityKw)} kW${genTag}`,
      };
    }

    case "thermal": {
      const ratio =
        eff.coolingCapacityBtuPerHr > 0
          ? Math.min(1, usage.heatOutputBtuPerHr / eff.coolingCapacityBtuPerHr)
          : 0;
      const color = mixHex("#38bdf8", ratio > 0.75 ? "#f43f5e" : "#fb923c", ratio);
      return {
        tintColor: color,
        accent: color,
        badgeDetail: `${Math.round(usage.heatOutputBtuPerHr / 1000)}k/${Math.round(eff.coolingCapacityBtuPerHr / 1000)}k BTU (${eff.coolingType.toUpperCase()})`,
      };
    }

    case "network": {
      const netColor = isFabricConnected
        ? "#e879f9"
        : eff.networkType === "fiber"
          ? "#22d3ee"
          : eff.networkType === "cat8"
            ? "#3b82f6"
            : "#94a3b8";
      return {
        tintColor: netColor,
        accent: netColor,
        badgeDetail: `${usage.bandwidthGbps}/${eff.bandwidthGbps} Gbps${isFabricConnected ? " · FABRIC" : ""}`,
      };
    }

    case "maintenance": {
      const color =
        repairingRackCount >= 2 ? "#ff4d6d" : repairingRackCount === 1 ? "#ffb703" : "#00f5a0";
      const healthText = repairingRackCount > 0 ? `${repairingRackCount} REPAIRING` : "HEALTHY";
      return {
        tintColor: color,
        accent: color,
        badgeDetail: `${healthText} · ${datacenter.maintenanceStaff} TECH`,
      };
    }
  }
}

function tintBuildingColors(
  baseTop: string,
  baseLeft: string,
  baseRight: string,
  overlayMode: InfoOverlayMode,
  tintColor: string,
): { topColor: string; leftColor: string; rightColor: string } {
  if (overlayMode === "standard") {
    return { topColor: baseTop, leftColor: baseLeft, rightColor: baseRight };
  }
  return {
    topColor: mixHex(baseTop, tintColor, 0.56),
    leftColor: mixHex(baseLeft, tintColor, 0.42),
    rightColor: mixHex(baseRight, tintColor, 0.48),
  };
}

function drawDatacenterUpgrades(
  ctx: CanvasRenderingContext2D,
  transform: CameraTransform,
  vw: number,
  vh: number,
  plot: PlotAnchor,
  summary: CityDatacenterSummary,
  isFabricConnected: boolean,
  timeSec: number,
  overlayMode: InfoOverlayMode,
): void {
  const { tileX, tileY } = plot;
  const eff = summary.infrastructure.effective;
  const fabricActive = isFabricConnected;

  // Liquid / Hybrid external chiller towers & cyan liquid manifolds
  if (eff.coolingType === "liquid" || eff.coolingType === "hybrid") {
    const chillerColor = overlayMode === "thermal" ? "#38bdf8" : "#00f5d4";
    const towerCount = eff.coolingType === "liquid" ? 2 : 1;
    for (let i = 0; i < towerCount; i++) {
      const cx = tileX + 1.66 - i * 0.34;
      const cy = tileY + 1.68;
      drawIsoCylinder(ctx, transform, vw, vh, {
        gx: cx,
        gy: cy,
        gz: 0.05,
        radius: 0.14,
        height: eff.coolingType === "liquid" ? 0.62 : 0.44,
        topColor: chillerColor,
        sideLeftColor: "#162b3a",
        sideRightColor: "#25485e",
        strokeColor: "#a5f3fc",
      });
    }
    drawIsoConduit(
      ctx,
      transform,
      vw,
      vh,
      [
        { gx: tileX + 1.66, gy: tileY + 1.68, gz: 0.18 },
        { gx: tileX + 1.25, gy: tileY + 1.68, gz: 0.18 },
        { gx: tileX + 1.25, gy: tileY + 1.38, gz: 0.18 },
      ],
      {
        color: chillerColor,
        widthPx: 2.2,
        glowColor: chillerColor,
        glowBlur: 7,
      },
    );
  }

  // Onsite generator annex & exhaust stacks
  if (eff.onsiteGenerationCapacityKw > 0) {
    const genAccent = overlayMode === "power" ? "#ffb703" : "#f59e0b";
    drawIsoBox(ctx, transform, vw, vh, {
      gx: tileX + 0.16,
      gy: tileY + 1.48,
      gz: 0.05,
      sx: 0.62,
      sy: 0.36,
      hz: 0.42,
      topColor: mixHex("#334155", genAccent, 0.32),
      leftColor: "#1f2937",
      rightColor: "#2b3648",
      strokeColor: genAccent,
      lineWidth: 0.9,
    });
    drawIsoCylinder(ctx, transform, vw, vh, {
      gx: tileX + 0.32,
      gy: tileY + 1.66,
      gz: 0.47,
      radius: 0.06,
      height: 0.36,
      topColor: "#e2e8f0",
      sideLeftColor: "#334155",
      sideRightColor: "#64748b",
    });
    drawIsoCylinder(ctx, transform, vw, vh, {
      gx: tileX + 0.56,
      gy: tileY + 1.66,
      gz: 0.47,
      radius: 0.06,
      height: 0.36,
      topColor: "#e2e8f0",
      sideLeftColor: "#334155",
      sideRightColor: "#64748b",
    });
  }

  // Optical exchange antenna for fabric-connected campuses
  if (fabricActive) {
    const pulse = 0.5 + 0.5 * Math.sin(timeSec * 4.2 + plot.lotIndex);
    const antX = tileX + 1.72;
    const antY = tileY + 0.28;
    drawIsoBox(ctx, transform, vw, vh, {
      gx: antX - 0.12,
      gy: antY - 0.12,
      gz: 0.05,
      sx: 0.24,
      sy: 0.24,
      hz: 0.22,
      topColor: "#311b47",
      leftColor: "#1b1029",
      rightColor: "#251638",
      strokeColor: "#e879f9",
    });
    drawIsoCylinder(ctx, transform, vw, vh, {
      gx: antX,
      gy: antY,
      gz: 0.27,
      radius: 0.05,
      height: 0.78,
      topColor: "#00f5d4",
      sideLeftColor: "#701a75",
      sideRightColor: "#e879f9",
      strokeColor: "#f5d0fe",
    });
    const tip = projectIso({ gx: antX, gy: antY, gz: 1.08 }, transform, vw, vh);
    ctx.save();
    ctx.fillStyle = pulse > 0.5 ? "#e879f9" : "#00f5d4";
    ctx.shadowColor = "#e879f9";
    ctx.shadowBlur = 10 * transform.zoom;
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, (2.4 + pulse * 1.1) * Math.max(0.7, transform.zoom), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawDatacenterComplex(
  ctx: CanvasRenderingContext2D,
  transform: CameraTransform,
  vw: number,
  vh: number,
  plot: PlotAnchor,
  summary: CityDatacenterSummary,
  isFabricConnected: boolean,
  input: CitySceneInput,
  isSelected: boolean,
  isHovered: boolean,
): { hitPolygon: ScreenPoint[]; roofAnchor: ScreenPoint; badgeText: string; accent: string } {
  const { tileX, tileY } = plot;
  const specId = summary.datacenter.spec.id as string;
  const style = resolveDcOverlayStyle(summary, input.overlayMode, isFabricConnected);
  const strokeAccent = isSelected ? "#ffffff" : isHovered ? "#72ffea" : style.accent;

  // Campus concrete pad + selection glow
  drawIsoTile(ctx, transform, vw, vh, {
    gx: tileX + 0.06,
    gy: tileY + 0.06,
    gz: 0.01,
    sx: 1.88,
    sy: 1.88,
    fill: isSelected ? "rgba(0, 245, 212, 0.2)" : "#182332",
    stroke: strokeAccent,
    lineWidth: isSelected ? 2.2 : isHovered ? 1.8 : 1.1,
    glowColor: isSelected || isHovered ? style.accent : undefined,
    glowBlur: isSelected ? 16 : isHovered ? 10 : 0,
  });

  let maxHeight = 1.0;

  if (specId === "garage") {
    maxHeight = 0.96;
    const cols = tintBuildingColors("#3c3534", "#241d1c", "#302725", input.overlayMode, style.tintColor);
    const body = drawIsoBox(ctx, transform, vw, vh, {
      gx: tileX + 0.34,
      gy: tileY + 0.3,
      gz: 0.04,
      sx: 1.18,
      sy: 1.12,
      hz: 0.68,
      topColor: cols.topColor,
      leftColor: cols.leftColor,
      rightColor: cols.rightColor,
      strokeColor: strokeAccent,
      lineWidth: isSelected ? 1.6 : 1,
      topHighlight: mixHex(style.accent, "#ffffff", 0.3),
    });
    // Delivery garage bay door on front-left + office window strip on front-right
    drawFaceRect(ctx, body.frontLeftQuad, 0.18, 0.25, 0.72, 0.98, "#0f172a", style.accent, 0.9);
    drawIsoWindowGrid(ctx, body.frontLeftQuad, 3, 1, () => "rgba(148, 163, 184, 0.24)", 0.22, 0.32);
    drawIsoWindowGrid(ctx, body.frontRightQuad, 1, 3, () => style.accent, 0.18, 0.28);

    // Rooftop AC unit
    drawIsoBox(ctx, transform, vw, vh, {
      gx: tileX + 0.68,
      gy: tileY + 0.62,
      gz: 0.72,
      sx: 0.44,
      sy: 0.38,
      hz: 0.2,
      topColor: "#475569",
      leftColor: "#1e293b",
      rightColor: "#334155",
      strokeColor: style.accent,
    });
  } else if (specId === "warehouse") {
    maxHeight = 1.32;
    const cols = tintBuildingColors("#2e3f54", "#182332", "#223145", input.overlayMode, style.tintColor);
    const hall = drawIsoBox(ctx, transform, vw, vh, {
      gx: tileX + 0.2,
      gy: tileY + 0.2,
      gz: 0.04,
      sx: 1.54,
      sy: 1.36,
      hz: 0.96,
      topColor: cols.topColor,
      leftColor: cols.leftColor,
      rightColor: cols.rightColor,
      strokeColor: strokeAccent,
      lineWidth: isSelected ? 1.6 : 1.05,
      topHighlight: mixHex(style.accent, "#ffffff", 0.35),
    });

    // Loading dock annex
    const dock = drawIsoBox(ctx, transform, vw, vh, {
      gx: tileX + 0.24,
      gy: tileY + 1.38,
      gz: 0.04,
      sx: 0.85,
      sy: 0.32,
      hz: 0.42,
      topColor: mixHex(cols.topColor, "#64748b", 0.2),
      leftColor: cols.leftColor,
      rightColor: cols.rightColor,
      strokeColor: style.accent,
    });
    drawFaceRect(ctx, dock.frontLeftQuad, 0.16, 0.25, 0.42, 0.95, "#090f1a", style.accent);
    drawFaceRect(ctx, dock.frontLeftQuad, 0.56, 0.25, 0.82, 0.95, "#090f1a", style.accent);

    drawIsoWindowGrid(ctx, hall.frontLeftQuad, 2, 5, (r) => (r === 0 ? style.accent : "rgba(15, 23, 42, 0.65)"));
    drawIsoWindowGrid(ctx, hall.frontRightQuad, 2, 4, (r) => (r === 0 ? style.accent : "rgba(15, 23, 42, 0.65)"));

    // Sawtooth rooftop chiller array
    for (let i = 0; i < 3; i++) {
      drawIsoBox(ctx, transform, vw, vh, {
        gx: tileX + 0.34 + i * 0.45,
        gy: tileY + 0.42,
        gz: 1.0,
        sx: 0.32,
        sy: 0.88,
        hz: 0.24,
        topColor: mixHex("#475569", style.accent, 0.35),
        leftColor: "#1e293b",
        rightColor: "#334155",
        strokeColor: style.accent,
      });
    }
  } else {
    // Hyperscale twin-hall megacampus
    maxHeight = 1.92;
    const cols = tintBuildingColors("#273b54", "#121e2e", "#1b2c42", input.overlayMode, style.tintColor);

    const westHall = drawIsoBox(ctx, transform, vw, vh, {
      gx: tileX + 0.16,
      gy: tileY + 0.18,
      gz: 0.04,
      sx: 0.7,
      sy: 1.38,
      hz: 1.42,
      topColor: cols.topColor,
      leftColor: cols.leftColor,
      rightColor: cols.rightColor,
      strokeColor: strokeAccent,
      lineWidth: isSelected ? 1.7 : 1.1,
      topHighlight: mixHex(style.accent, "#ffffff", 0.45),
    });
    const eastHall = drawIsoBox(ctx, transform, vw, vh, {
      gx: tileX + 1.12,
      gy: tileY + 0.18,
      gz: 0.04,
      sx: 0.7,
      sy: 1.38,
      hz: 1.42,
      topColor: cols.topColor,
      leftColor: cols.leftColor,
      rightColor: cols.rightColor,
      strokeColor: strokeAccent,
      lineWidth: isSelected ? 1.7 : 1.1,
      topHighlight: mixHex(style.accent, "#ffffff", 0.45),
    });

    // Illuminated hall facades
    drawIsoWindowGrid(ctx, westHall.frontLeftQuad, 4, 3, (r) => (r % 2 === 0 ? style.accent : "#38bdf8"));
    drawIsoWindowGrid(ctx, eastHall.frontLeftQuad, 4, 3, (r) => (r % 2 === 0 ? style.accent : "#38bdf8"));
    drawIsoWindowGrid(ctx, eastHall.frontRightQuad, 4, 4, (r) => (r % 2 === 0 ? style.accent : "#38bdf8"));

    // Elevated skybridge linking twin halls
    drawIsoBox(ctx, transform, vw, vh, {
      gx: tileX + 0.84,
      gy: tileY + 0.6,
      gz: 0.88,
      sx: 0.3,
      sy: 0.56,
      hz: 0.32,
      topColor: mixHex("#38bdf8", style.accent, 0.5),
      leftColor: "#0c4a6e",
      rightColor: "#0369a1",
      strokeColor: "#e0f2fe",
    });

    // Dual courtyard substation condensers between halls
    drawIsoCylinder(ctx, transform, vw, vh, {
      gx: tileX + 0.99,
      gy: tileY + 1.38,
      gz: 0.04,
      radius: 0.13,
      height: 0.46,
      topColor: style.accent,
      sideLeftColor: "#1e293b",
      sideRightColor: "#475569",
    });

    // Skyline rooftop crowns
    for (const hallX of [tileX + 0.26, tileX + 1.22]) {
      drawIsoBox(ctx, transform, vw, vh, {
        gx: hallX,
        gy: tileY + 0.34,
        gz: 1.46,
        sx: 0.5,
        sy: 1.04,
        hz: 0.28,
        topColor: mixHex(cols.topColor, style.accent, 0.42),
        leftColor: cols.leftColor,
        rightColor: cols.rightColor,
        strokeColor: style.accent,
      });
    }
  }

  // Dynamic upgrade annexes from summary.infrastructure.effective
  drawDatacenterUpgrades(ctx, transform, vw, vh, plot, summary, isFabricConnected, input.timeSec, input.overlayMode);

  const hitPolygon = projectPrismSilhouette(
    tileX + 0.06,
    tileY + 0.06,
    0,
    1.88,
    1.88,
    maxHeight,
    transform,
    vw,
    vh,
  );
  const roofAnchor = projectIso(
    { gx: tileX + 1.0, gy: tileY + 1.0, gz: maxHeight + 0.1 },
    transform,
    vw,
    vh,
  );

  return {
    hitPolygon,
    roofAnchor,
    badgeText: `${summary.datacenter.name} · ${style.badgeDetail}`,
    accent: style.accent,
  };
}

function drawVacantLot(
  ctx: CanvasRenderingContext2D,
  transform: CameraTransform,
  vw: number,
  vh: number,
  plot: PlotAnchor,
  buildDcToolActive: boolean,
  isHovered: boolean,
  timeSec: number,
): { hitPolygon: ScreenPoint[]; roofAnchor: ScreenPoint; accent: string } {
  const { tileX, tileY } = plot;
  const pulse = 0.5 + 0.5 * Math.sin(timeSec * 3.5 + plot.lotIndex);
  const activeHighlight = buildDcToolActive || isHovered;
  const accent = buildDcToolActive ? "#00f5d4" : isHovered ? "#fcd34d" : "#ffb703";

  const padQuad = drawIsoTile(ctx, transform, vw, vh, {
    gx: tileX + 0.12,
    gy: tileY + 0.12,
    gz: 0.01,
    sx: 1.76,
    sy: 1.76,
    fill: activeHighlight ? `rgba(0, 245, 212, ${0.12 + pulse * 0.1})` : "rgba(255, 183, 3, 0.08)",
    stroke: accent,
    lineWidth: activeHighlight ? 2 : 1.2,
    dashed: !activeHighlight,
    glowColor: activeHighlight ? accent : undefined,
    glowBlur: activeHighlight ? 12 + pulse * 6 : 0,
  });

  // Ground "+ ZONE DC" inner marking box
  drawIsoTile(ctx, transform, vw, vh, {
    gx: tileX + 0.5,
    gy: tileY + 0.5,
    gz: 0.015,
    sx: 1.0,
    sy: 1.0,
    fill: "rgba(15, 23, 42, 0.45)",
    stroke: accent,
    lineWidth: 0.9,
    dashed: true,
  });

  // 4 corner cyber zoning pylons
  const corners: readonly [number, number][] = [
    [tileX + 0.16, tileY + 0.16],
    [tileX + 1.72, tileY + 0.16],
    [tileX + 0.16, tileY + 1.72],
    [tileX + 1.72, tileY + 1.72],
  ];
  for (const [cx, cy] of corners) {
    drawIsoBox(ctx, transform, vw, vh, {
      gx: cx,
      gy: cy,
      gz: 0.01,
      sx: 0.12,
      sy: 0.12,
      hz: activeHighlight ? 0.34 : 0.22,
      topColor: accent,
      leftColor: "#1e293b",
      rightColor: "#334155",
      strokeColor: "#ffffff",
      lineWidth: 0.7,
    });
  }

  // Ground center "+ ZONE DC" text
  const quadTuple = padQuad as [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint];
  const center = bilerpQuad(quadTuple, 0.5, 0.5);
  ctx.save();
  ctx.font = `700 ${Math.max(8, Math.round(9 * transform.zoom))}px "JetBrains Mono", monospace`;
  ctx.fillStyle = accent;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("+ ZONE DC", center.x, center.y);
  ctx.restore();

  const hitPolygon = projectPrismSilhouette(
    tileX + 0.12,
    tileY + 0.12,
    0,
    1.76,
    1.76,
    0.34,
    transform,
    vw,
    vh,
  );
  const roofAnchor = projectIso(
    { gx: tileX + 1.0, gy: tileY + 1.0, gz: 0.42 },
    transform,
    vw,
    vh,
  );

  return { hitPolygon, roofAnchor, accent };
}

/**
 * Render the 12x12 Cities: Skylines-inspired isometric district view for a region.
 * Returns front-to-back depth-sorted interactive hit targets for picking.
 */
export function renderCityScene(
  ctx: CanvasRenderingContext2D,
  viewportWidth: number,
  viewportHeight: number,
  input: CitySceneInput,
): CityHitTarget[] {
  const transform = toCameraTransform(input.camera, CITY_GRID_SIZE, CITY_GRID_SIZE);
  const regionSeed = hashString(input.region.id);

  // 1. Atmospheric backdrop
  drawDistrictBackdrop(ctx, viewportWidth, viewportHeight, input.overlayMode);

  // 2. 12x12 district terrain slab with depth skirt (gz: -0.25..0)
  drawIsoBox(ctx, transform, viewportWidth, viewportHeight, {
    gx: 0,
    gy: 0,
    gz: -0.25,
    sx: CITY_GRID_SIZE,
    sy: CITY_GRID_SIZE,
    hz: 0.25,
    topColor: input.overlayMode === "standard" ? "#121b28" : "#0c131d",
    leftColor: "#0a111a",
    rightColor: "#0f1824",
    strokeColor: "rgba(0, 245, 212, 0.28)",
    lineWidth: 1.2,
  });

  // 3. Flat ground layer: concrete blocks, roads, water canal, park plaza tiles
  for (let gx = 0; gx < CITY_GRID_SIZE; gx++) {
    for (let gy = 0; gy < CITY_GRID_SIZE; gy++) {
      const key = cellKey(gx, gy);
      if (isRoadTile(gx, gy)) {
        drawRoadTile(ctx, transform, viewportWidth, viewportHeight, gx, gy, input.overlayMode);
      } else if (CANAL_TILES.has(key)) {
        drawWaterCanalTile(ctx, transform, viewportWidth, viewportHeight, gx, gy, input.timeSec, input.overlayMode);
      } else if (PARK_TILES.has(key)) {
        drawParkPlazaTile(ctx, transform, viewportWidth, viewportHeight, gx, gy, input.overlayMode);
      } else {
        drawIsoTile(ctx, transform, viewportWidth, viewportHeight, {
          gx,
          gy,
          gz: 0,
          sx: 1,
          sy: 1,
          fill: input.overlayMode === "standard" ? "#141f2e" : "#0e1722",
          stroke: "rgba(148, 163, 184, 0.1)",
          lineWidth: 0.6,
        });
      }
    }
  }

  // Pedestrian canal footbridge at (5..6, 6)
  drawIsoBox(ctx, transform, viewportWidth, viewportHeight, {
    gx: 5.55,
    gy: 6.08,
    gz: 0.01,
    sx: 0.9,
    sy: 0.84,
    hz: 0.08,
    topColor: "#334155",
    leftColor: "#1e293b",
    rightColor: "#273549",
    strokeColor: "#64748b",
  });

  // Determine which DCs are linked to the regional fiber fabric
  const fabricMemberIds = new Set<DatacenterId>(input.regionFabric?.memberDcIds ?? []);
  const summariesByPlot = new Map<number, CityDatacenterSummary>();
  for (let i = 0; i < input.datacenters.length && i < DC_CAMPUS_PLOTS.length; i++) {
    const summary = input.datacenters[i];
    if (summary) {
      summariesByPlot.set(i, summary);
    }
  }

  const connectedPlots: PlotAnchor[] = [];
  for (const plot of DC_CAMPUS_PLOTS) {
    const summary = summariesByPlot.get(plot.lotIndex);
    if (summary && (summary.fabricConnected || fabricMemberIds.has(summary.datacenter.id))) {
      connectedPlots.push(plot);
    }
  }

  // 4. Optical ring conduits along avenue corridors connecting fiber_exchange to fabricConnected DCs
  for (const plot of connectedPlots) {
    const glowColor = input.overlayMode === "network" ? "#00f5d4" : "#e879f9";
    drawIsoConduit(ctx, transform, viewportWidth, viewportHeight, plot.conduitWaypoints, {
      color: "rgba(232, 121, 249, 0.45)",
      widthPx: input.overlayMode === "network" ? 4.8 : 3.2,
      glowColor,
      glowBlur: input.overlayMode === "network" ? 14 : 8,
    });
    drawIsoConduit(ctx, transform, viewportWidth, viewportHeight, plot.conduitWaypoints, {
      color: "#00f5d4",
      widthPx: 1.8,
      dashed: true,
      dashPattern: [7, 9],
      dashOffset: -input.timeSec * 28,
    });
  }

  // Subtle eligible-for-fabric hint lines in network overlay mode
  if (input.overlayMode === "network" && input.regionFabric) {
    const eligibleSet = new Set<DatacenterId>(input.regionFabric.eligibleDcIds);
    for (const plot of DC_CAMPUS_PLOTS) {
      const summary = summariesByPlot.get(plot.lotIndex);
      if (
        summary &&
        eligibleSet.has(summary.datacenter.id) &&
        !summary.fabricConnected &&
        !fabricMemberIds.has(summary.datacenter.id)
      ) {
        drawIsoConduit(ctx, transform, viewportWidth, viewportHeight, plot.conduitWaypoints, {
          color: "rgba(56, 189, 248, 0.38)",
          widthPx: 1.4,
          dashed: true,
          dashPattern: [4, 8],
          alpha: 0.75,
        });
      }
    }
  }

  // 5. Gather all 3D entities for painter's-algorithm back-to-front depth sorting
  const renderables: DepthRenderItem[] = [];
  const hitTargets: CityHitTarget[] = [];
  const pendingBadges: PendingBadge[] = [];

  // 5a. Procedural urban skyline buildings & park trees
  for (let gx = 0; gx < CITY_GRID_SIZE; gx++) {
    for (let gy = 0; gy < CITY_GRID_SIZE; gy++) {
      const key = cellKey(gx, gy);
      if (PARK_TILES.has(key)) {
        const treeScale = 0.85 + seededFloat(regionSeed, gx, gy, 77) * 0.35;
        const depth = computeDepthKey(gx + 0.5, gy + 0.5, 0.1, CITY_GRID_SIZE, CITY_GRID_SIZE, input.camera.rotation);
        renderables.push({
          depth,
          draw: () => drawStylizedTree(ctx, transform, viewportWidth, viewportHeight, gx + 0.5, gy + 0.5, treeScale, input.overlayMode),
        });
        continue;
      }
      if (isReservedCell(gx, gy)) continue;

      const depth = computeDepthKey(gx + 0.5, gy + 0.5, 0.2, CITY_GRID_SIZE, CITY_GRID_SIZE, input.camera.rotation);
      renderables.push({
        depth,
        draw: () =>
          drawSkylineBuilding(
            ctx,
            transform,
            viewportWidth,
            viewportHeight,
            gx,
            gy,
            regionSeed,
            input.overlayMode,
            input.timeSec,
          ),
      });
    }
  }

  // 5b. Animated 2-way avenue traffic
  const vehicles: Array<{ axis: "x" | "y"; fixedCoord: number; speed: number; phase: number; color: string }> = [
    { axis: "y", fixedCoord: 3.28, speed: 1.35, phase: 1.2, color: "#38bdf8" },
    { axis: "y", fixedCoord: 3.72, speed: -1.6, phase: 7.4, color: "#f59e0b" },
    { axis: "y", fixedCoord: 8.28, speed: 1.15, phase: 4.8, color: "#e2e8f0" },
    { axis: "y", fixedCoord: 8.72, speed: -1.45, phase: 9.1, color: "#00f5d4" },
    { axis: "x", fixedCoord: 3.72, speed: 1.5, phase: 2.5, color: "#f43f5e" },
    { axis: "x", fixedCoord: 3.28, speed: -1.25, phase: 6.3, color: "#e2e8f0" },
    { axis: "x", fixedCoord: 8.72, speed: 1.4, phase: 0.6, color: "#fbbf24" },
    { axis: "x", fixedCoord: 8.28, speed: -1.55, phase: 8.7, color: "#38bdf8" },
  ];

  for (const v of vehicles) {
    const raw = (v.phase + v.speed * input.timeSec) % (CITY_GRID_SIZE - 0.6);
    const wrapped = 0.3 + ((raw + (CITY_GRID_SIZE - 0.6)) % (CITY_GRID_SIZE - 0.6));
    const gx = v.axis === "x" ? wrapped : v.fixedCoord;
    const gy = v.axis === "y" ? wrapped : v.fixedCoord;
    const depth = computeDepthKey(gx, gy, 0.08, CITY_GRID_SIZE, CITY_GRID_SIZE, input.camera.rotation);
    renderables.push({
      depth,
      draw: () => drawVehicle(ctx, transform, viewportWidth, viewportHeight, gx, gy, v.axis, v.color, input.overlayMode),
    });
  }

  // 5c. Three municipal civic landmarks
  for (const lm of LANDMARK_ANCHORS) {
    const centerX = lm.tileX + 1.0;
    const centerY = lm.tileY + 1.0;
    const depth = computeDepthKey(centerX, centerY, 0.25, CITY_GRID_SIZE, CITY_GRID_SIZE, input.camera.rotation);
    const isHovered = input.hoveredTarget?.kind === "landmark" && input.hoveredTarget.landmarkId === lm.landmarkId;

    const hitPolygon = projectPrismSilhouette(
      lm.tileX + 0.08,
      lm.tileY + 0.08,
      0,
      1.84,
      1.84,
      lm.heightUnits,
      transform,
      viewportWidth,
      viewportHeight,
    );
    hitTargets.push({
      kind: "landmark",
      landmarkId: lm.landmarkId,
      label: lm.label,
      gx: centerX,
      gy: centerY,
      hitPolygon,
      depth,
    });

    renderables.push({
      depth,
      draw: () => {
        const res =
          lm.landmarkId === "power_substation"
            ? drawPowerSubstation(ctx, transform, viewportWidth, viewportHeight, lm, input, isHovered)
            : lm.landmarkId === "fiber_exchange"
              ? drawFiberExchange(
                  ctx,
                  transform,
                  viewportWidth,
                  viewportHeight,
                  lm,
                  input,
                  connectedPlots.length,
                  isHovered,
                )
              : drawWorkforceCampus(ctx, transform, viewportWidth, viewportHeight, lm, input, isHovered);

        pendingBadges.push({
          depth,
          anchor: res.roofAnchor,
          label: res.badgeText,
          border: res.accent,
          textColor: res.accent,
          fontSizePx: 9,
        });
      },
    });
  }

  // 5d. Six zoned industrial datacenter campus plots (occupied complexes & vacant lots)
  for (const plot of DC_CAMPUS_PLOTS) {
    const summary = summariesByPlot.get(plot.lotIndex);
    const centerX = plot.tileX + 1.0;
    const centerY = plot.tileY + 1.0;

    if (summary) {
      const depth = computeDepthKey(centerX, centerY, 0.25, CITY_GRID_SIZE, CITY_GRID_SIZE, input.camera.rotation);
      const isSelected = input.selectedDcId === summary.datacenter.id;
      const isHovered =
        input.hoveredTarget?.kind === "datacenter" && input.hoveredTarget.dcId === summary.datacenter.id;

      // Height approximation for pre-draw hit silhouette matches drawDatacenterComplex
      const specId = summary.datacenter.spec.id as string;
      const estHeight = specId === "garage" ? 0.96 : specId === "warehouse" ? 1.32 : 1.92;
      const hitPolygon = projectPrismSilhouette(
        plot.tileX + 0.06,
        plot.tileY + 0.06,
        0,
        1.88,
        1.88,
        estHeight,
        transform,
        viewportWidth,
        viewportHeight,
      );

      hitTargets.push({
        kind: "datacenter",
        dcId: summary.datacenter.id,
        regionId: input.region.id,
        gx: centerX,
        gy: centerY,
        hitPolygon,
        depth,
      });

      renderables.push({
        depth,
        draw: () => {
          const isFabricConnected = summary.fabricConnected || fabricMemberIds.has(summary.datacenter.id);
          const res = drawDatacenterComplex(
            ctx,
            transform,
            viewportWidth,
            viewportHeight,
            plot,
            summary,
            isFabricConnected,
            input,
            isSelected,
            isHovered,
          );
          pendingBadges.push({
            depth: depth + 5,
            anchor: res.roofAnchor,
            label: res.badgeText,
            bg: isSelected ? "rgba(0, 32, 34, 0.94)" : "rgba(7, 13, 22, 0.9)",
            border: isSelected ? "#ffffff" : res.accent,
            textColor: isSelected ? "#72ffea" : res.accent,
            fontSizePx: 10,
          });
        },
      });
    } else {
      const depth = computeDepthKey(centerX, centerY, 0.06, CITY_GRID_SIZE, CITY_GRID_SIZE, input.camera.rotation);
      const isHovered =
        input.hoveredTarget?.kind === "vacant_lot" && input.hoveredTarget.lotIndex === plot.lotIndex;

      const hitPolygon = projectPrismSilhouette(
        plot.tileX + 0.12,
        plot.tileY + 0.12,
        0,
        1.76,
        1.76,
        0.34,
        transform,
        viewportWidth,
        viewportHeight,
      );

      hitTargets.push({
        kind: "vacant_lot",
        lotIndex: plot.lotIndex,
        regionId: input.region.id,
        gx: centerX,
        gy: centerY,
        hitPolygon,
        depth,
      });

      renderables.push({
        depth,
        draw: () => {
          const res = drawVacantLot(
            ctx,
            transform,
            viewportWidth,
            viewportHeight,
            plot,
            input.buildDcToolActive,
            isHovered,
            input.timeSec,
          );
          if (input.buildDcToolActive || isHovered) {
            pendingBadges.push({
              depth,
              anchor: res.roofAnchor,
              label: `LOT ${plot.lotIndex + 1} · BUILD DC`,
              border: res.accent,
              textColor: res.accent,
              fontSizePx: 9,
            });
          }
        },
      });
    }
  }

  // 6. Execute back-to-front painter's sort
  renderables.sort((a, b) => a.depth - b.depth);
  for (const item of renderables) {
    item.draw();
  }

  // 7. Render floating HUD badges in final pass sorted back-to-front
  pendingBadges.sort((a, b) => a.depth - b.depth);
  for (const badge of pendingBadges) {
    drawIsoBadge(ctx, badge.anchor, badge.label, {
      bg: badge.bg,
      border: badge.border,
      textColor: badge.textColor,
      fontSizePx: badge.fontSizePx,
    });
  }

  hitTargets.sort((a, b) => a.depth - b.depth);
  return hitTargets;
}
