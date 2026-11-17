import {
  canPlaceRack,
  RACK_CATALOG,
  type Datacenter,
  type DatacenterInfrastructureView,
  type DatacenterRackMaintenanceStatusView,
  type DatacenterResourceUsage,
  type PlacementFailureReason,
  type RackActivityStatus,
  type RackActivityView,
  type RackPlacement,
  type RackPlacementId,
  type RackSpec,
  type RackSpecId,
} from "@datacenter-tycoon/game-logic";
import { toCameraTransform, type IsoCameraState } from "./camera.js";
import {
  computeDepthKey,
  projectIso,
  projectPrismSilhouette,
  type CameraTransform,
  type IsoPoint3D,
  type IsoRotation,
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
import { drawProceduralRack3D, type InfoOverlayMode } from "./rackModels3d.js";

export type FloorHitTarget =
  | {
      kind: "rack";
      placementId: RackPlacementId;
      row: number;
      position: number;
      specId: RackSpecId;
      hitPolygon: ScreenPoint[];
      depth: number;
    }
  | {
      kind: "slot";
      row: number;
      position: number;
      canPlace: boolean;
      blockReason?: PlacementFailureReason;
      hitPolygon: ScreenPoint[];
      depth: number;
    }
  | {
      kind: "equipment";
      equipmentId: "crac" | "pdu" | "noc" | "generator";
      label: string;
      hitPolygon: ScreenPoint[];
      depth: number;
    };

export interface FloorSceneInput {
  datacenter: Datacenter;
  infrastructure: DatacenterInfrastructureView;
  usage: DatacenterResourceUsage;
  rackActivities: readonly RackActivityView[];
  rackMaintenance: readonly DatacenterRackMaintenanceStatusView[];
  camera: IsoCameraState;
  overlayMode: InfoOverlayMode;
  activeRackSpecId: RackSpecId | null;
  selectedPlacementId: RackPlacementId | null;
  selectedSlot: { row: number; position: number } | null;
  hoveredTarget: FloorHitTarget | null;
  canPlaceAtSlot?: (
    row: number,
    position: number,
    specId: RackSpecId,
  ) => { ok: boolean; reason?: PlacementFailureReason };
  timeSec: number;
}

interface RenderQueueItem {
  depth: number;
  draw: () => void;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  viewportWidth: number,
  viewportHeight: number,
): void {
  const grad = ctx.createRadialGradient(
    viewportWidth * 0.5,
    viewportHeight * 0.45,
    40,
    viewportWidth * 0.5,
    viewportHeight * 0.5,
    Math.max(viewportWidth, viewportHeight) * 0.78,
  );
  grad.addColorStop(0, "#0b1525");
  grad.addColorStop(0.55, "#070e19");
  grad.addColorStop(1, "#04070d");

  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);

  // Architectural blueprint grid backdrop
  ctx.strokeStyle = "rgba(56, 189, 248, 0.04)";
  ctx.lineWidth = 1;
  const step = 48;
  ctx.beginPath();
  for (let x = (viewportWidth * 0.5) % step; x < viewportWidth; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, viewportHeight);
  }
  for (let y = (viewportHeight * 0.5) % step; y < viewportHeight; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(viewportWidth, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawFoundationSlabAndPlenum(
  ctx: CanvasRenderingContext2D,
  transform: CameraTransform,
  viewportWidth: number,
  viewportHeight: number,
  cols: number,
  rows: number,
  input: FloorSceneInput,
): void {
  const slabBox = drawIsoBox(ctx, transform, viewportWidth, viewportHeight, {
    gx: -0.85,
    gy: -0.85,
    gz: -0.34,
    sx: cols + 1.7,
    sy: rows + 1.7,
    hz: 0.34,
    topColor: "#0a121f",
    leftColor: "#0e1828",
    rightColor: "#142238",
    strokeColor: "#1f3a5c",
    lineWidth: 1.25,
    topHighlight: "rgba(56, 189, 248, 0.34)",
  });

  // Cutaway plenum cross-section strata on front-facing foundation faces
  for (const faceQuad of [slabBox.frontLeftQuad, slabBox.frontRightQuad]) {
    drawFaceRect(
      ctx,
      faceQuad,
      0.01,
      0.24,
      0.99,
      0.62,
      "rgba(4, 9, 17, 0.85)",
      "rgba(56, 189, 248, 0.16)",
      0.8,
    );
    drawFaceRect(ctx, faceQuad, 0.01, 0.34, 0.99, 0.4, "rgba(0, 180, 216, 0.32)");
    drawFaceRect(ctx, faceQuad, 0.01, 0.49, 0.99, 0.54, "rgba(245, 158, 11, 0.32)");
  }

  // Recessed under-floor plenum floor pad
  drawIsoTile(ctx, transform, viewportWidth, viewportHeight, {
    gx: -0.7,
    gy: -0.7,
    gz: -0.02,
    sx: cols + 1.4,
    sy: rows + 1.4,
    fill: "#060b14",
    stroke: "rgba(56, 189, 248, 0.22)",
    lineWidth: 1,
  });

  const powerLoad = clamp01(
    input.usage.powerKw / Math.max(1, input.infrastructure.effective.rackPowerCapacityKw),
  );
  const coolingLoad = clamp01(
    input.usage.heatOutputBtuPerHr / Math.max(1, input.infrastructure.effective.coolingCapacityBtuPerHr),
  );
  const netLoad = clamp01(
    input.usage.bandwidthGbps / Math.max(1, input.infrastructure.effective.bandwidthGbps),
  );

  const isPowerLens = input.overlayMode === "power";
  const isThermalLens = input.overlayMode === "thermal";
  const isNetworkLens = input.overlayMode === "network";

  const waterDashOffset = -(input.timeSec * 22) % 28;
  const powerDashOffset = -(input.timeSec * (18 + powerLoad * 24)) % 28;

  // Chilled-water supply header manifold from CRAC bank
  const chillerHeader: IsoPoint3D[] = [
    { gx: -0.38, gy: -0.28, gz: -0.012 },
    { gx: cols + 0.32, gy: -0.28, gz: -0.012 },
    { gx: cols + 0.32, gy: rows - 0.35, gz: -0.012 },
  ];
  drawIsoConduit(ctx, transform, viewportWidth, viewportHeight, chillerHeader, {
    color: "#00b4d8",
    widthPx: isThermalLens ? 3.4 : 2.3,
    glowColor: "#00b4d8",
    glowBlur: isThermalLens ? 12 : 6,
    alpha: isThermalLens ? 0.95 : 0.72,
  });

  // High-voltage copper/gold busbar trunk from PDU switchgear
  const busbarTrunk: IsoPoint3D[] = [
    { gx: -0.34, gy: -0.22, gz: -0.008 },
    { gx: -0.34, gy: rows + 0.26, gz: -0.008 },
    { gx: cols + 0.28, gy: rows + 0.26, gz: -0.008 },
  ];
  drawIsoConduit(ctx, transform, viewportWidth, viewportHeight, busbarTrunk, {
    color: "#f59e0b",
    widthPx: isPowerLens ? 3.5 : 2.3,
    glowColor: "#f59e0b",
    glowBlur: isPowerLens ? 12 : 6,
    alpha: isPowerLens ? 0.95 : 0.74,
  });

  // Under-floor aisle branches running under each row
  for (let row = 0; row < rows; row++) {
    const chillerY = row + 0.34;
    const busbarY = row + 0.66;

    const waterBranch: IsoPoint3D[] = [
      { gx: -0.38, gy: chillerY, gz: -0.012 },
      { gx: cols + 0.32, gy: chillerY, gz: -0.012 },
    ];
    drawIsoConduit(ctx, transform, viewportWidth, viewportHeight, waterBranch, {
      color: "#00b4d8",
      widthPx: isThermalLens ? 2.4 : 1.7,
      alpha: isThermalLens ? 0.92 : 0.62,
    });
    drawIsoConduit(ctx, transform, viewportWidth, viewportHeight, waterBranch, {
      color: "#90e0ef",
      widthPx: isThermalLens ? 1.8 : 1.2,
      dashed: true,
      dashPattern: [7, 11],
      dashOffset: waterDashOffset + row * 4,
      glowColor: "#00b4d8",
      glowBlur: 6 + coolingLoad * 6,
      alpha: 0.9,
    });

    const powerBranch: IsoPoint3D[] = [
      { gx: -0.34, gy: busbarY, gz: -0.008 },
      { gx: cols + 0.28, gy: busbarY, gz: -0.008 },
    ];
    drawIsoConduit(ctx, transform, viewportWidth, viewportHeight, powerBranch, {
      color: "#f59e0b",
      widthPx: isPowerLens ? 2.5 : 1.7,
      alpha: isPowerLens ? 0.94 : 0.64,
    });
    drawIsoConduit(ctx, transform, viewportWidth, viewportHeight, powerBranch, {
      color: "#fde68a",
      widthPx: isPowerLens ? 1.8 : 1.2,
      dashed: true,
      dashPattern: [6, 12],
      dashOffset: powerDashOffset + row * 5,
      glowColor: "#f59e0b",
      glowBlur: 5 + powerLoad * 7,
      alpha: 0.9,
    });

    if (isNetworkLens) {
      drawIsoConduit(
        ctx,
        transform,
        viewportWidth,
        viewportHeight,
        [
          { gx: -0.25, gy: row + 0.5, gz: -0.005 },
          { gx: cols + 0.25, gy: row + 0.5, gz: -0.005 },
        ],
        {
          color: "#a855f7",
          widthPx: 2.0,
          dashed: true,
          dashPattern: [5, 7],
          dashOffset: -(input.timeSec * (16 + netLoad * 20)) % 24,
          glowColor: "#a855f7",
          glowBlur: 8,
          alpha: 0.85,
        },
      );
    }
  }
}

interface WallSegment {
  gx: number;
  gy: number;
  sx: number;
  sy: number;
  depth: number;
}

function getBackWallsForRotation(
  cols: number,
  rows: number,
  rotation: IsoRotation,
  thickness: number,
): WallSegment[] {
  const minX = -0.85;
  const minY = -0.85;
  const maxX = cols + 0.85;
  const maxY = rows + 0.85;
  const spanX = cols + 1.7;
  const spanY = rows + 1.7;

  let segments: Array<Omit<WallSegment, "depth">>;
  switch (rotation) {
    case 0:
      // Back faces: W (gx = minX) and N (gy = minY)
      segments = [
        { gx: minX, gy: minY, sx: thickness, sy: spanY },
        { gx: minX + thickness, gy: minY, sx: spanX - thickness, sy: thickness },
      ];
      break;
    case 1:
      // Back faces: W (gx = minX) and S (gy = maxY - thickness)
      segments = [
        { gx: minX, gy: minY, sx: thickness, sy: spanY },
        { gx: minX + thickness, gy: maxY - thickness, sx: spanX - thickness, sy: thickness },
      ];
      break;
    case 2:
      // Back faces: E (gx = maxX - thickness) and S (gy = maxY - thickness)
      segments = [
        { gx: maxX - thickness, gy: minY, sx: thickness, sy: spanY },
        { gx: minX, gy: maxY - thickness, sx: spanX - thickness, sy: thickness },
      ];
      break;
    case 3:
      // Back faces: N (gy = minY) and E (gx = maxX - thickness)
      segments = [
        { gx: minX, gy: minY, sx: spanX, sy: thickness },
        { gx: maxX - thickness, gy: minY + thickness, sx: thickness, sy: spanY - thickness },
      ];
      break;
  }

  return segments
    .map((seg) => ({
      ...seg,
      depth: computeDepthKey(seg.gx + seg.sx * 0.5, seg.gy + seg.sy * 0.5, 0, cols, rows, rotation),
    }))
    .sort((a, b) => a.depth - b.depth);
}

function drawCutawayBackWalls(
  ctx: CanvasRenderingContext2D,
  transform: CameraTransform,
  viewportWidth: number,
  viewportHeight: number,
  cols: number,
  rows: number,
  camera: IsoCameraState,
): void {
  const wallHz = camera.cutaway ? 0.44 : 2.25;
  const wallThick = 0.12;
  const walls = getBackWallsForRotation(cols, rows, camera.rotation, wallThick);

  for (const wall of walls) {
    const box = drawIsoBox(ctx, transform, viewportWidth, viewportHeight, {
      gx: wall.gx,
      gy: wall.gy,
      gz: 0,
      sx: wall.sx,
      sy: wall.sy,
      hz: wallHz,
      topColor: "#1b293f",
      leftColor: "#101b2d",
      rightColor: "#16243a",
      strokeColor: "#2b4568",
      lineWidth: 1,
      topHighlight: camera.cutaway ? "rgba(56, 189, 248, 0.45)" : "rgba(148, 163, 184, 0.35)",
    });

    if (!camera.cutaway) {
      // Full-height wall architectural panels & perimeter telemetry light strips
      const longQuads =
        wall.sx >= wall.sy ? [box.frontLeftQuad] : [box.frontRightQuad];
      for (const quad of longQuads) {
        drawFaceRect(ctx, quad, 0.02, 0.14, 0.98, 0.18, "rgba(0, 245, 212, 0.32)");
        drawFaceRect(ctx, quad, 0.02, 0.88, 0.98, 0.93, "rgba(56, 189, 248, 0.25)");
        drawIsoWindowGrid(
          ctx,
          quad,
          2,
          Math.max(3, Math.round(Math.max(wall.sx, wall.sy) * 1.4)),
          (r) => (r === 0 ? "rgba(15, 23, 42, 0.55)" : "rgba(30, 41, 59, 0.42)"),
          0.06,
          0.25,
        );
      }
    }
  }
}

function resolveFloorTileColors(
  row: number,
  rack: RackPlacement | undefined,
  activity: RackActivityView | undefined,
  maint: DatacenterRackMaintenanceStatusView | undefined,
  usage: DatacenterResourceUsage,
  infrastructure: DatacenterInfrastructureView,
  overlayMode: InfoOverlayMode,
): { fill: string; stroke: string; accentStripe: string } {
  const isColdAisle = row % 2 === 0;
  const spec = rack ? RACK_CATALOG[rack.specId] : undefined;

  switch (overlayMode) {
    case "standard": {
      if (isColdAisle) {
        return {
          fill: "rgba(13, 28, 46, 0.85)",
          stroke: "rgba(56, 189, 248, 0.24)",
          accentStripe: "rgba(0, 180, 216, 0.35)",
        };
      }
      return {
        fill: "rgba(21, 25, 38, 0.88)",
        stroke: "rgba(148, 163, 184, 0.18)",
        accentStripe: "rgba(245, 158, 11, 0.22)",
      };
    }

    case "power": {
      const facilityPowerRatio = clamp01(
        usage.powerKw / Math.max(1, infrastructure.effective.rackPowerCapacityKw),
      );
      const localRatio =
        spec && activity
          ? clamp01(activity.billedPowerKw / Math.max(1, spec.powerDrawKw))
          : facilityPowerRatio * 0.45;
      const tint = mixHex("#0e2439", localRatio > 0.7 ? "#f43f5e" : "#f59e0b", 0.3 + localRatio * 0.65);
      return {
        fill: tint,
        stroke: mixHex("#1e3a5f", "#fbbf24", localRatio),
        accentStripe: "rgba(245, 158, 11, 0.42)",
      };
    }

    case "thermal": {
      const facilityHeatRatio = clamp01(
        usage.heatOutputBtuPerHr / Math.max(1, infrastructure.effective.coolingCapacityBtuPerHr),
      );
      const rowHeat = isColdAisle ? 0.18 + facilityHeatRatio * 0.35 : 0.42 + facilityHeatRatio * 0.45;
      const isRackBusy = activity?.status !== undefined && activity.status !== "idle" && activity.status !== "repairing";
      const rackBoost = spec ? (isRackBusy ? 0.26 : 0.08) + spec.tier * 0.06 : 0;
      const ratio = clamp01(rowHeat + rackBoost);
      const tint = mixHex("#0b2c44", ratio > 0.65 ? "#ef4444" : "#fb923c", ratio);
      return {
        fill: tint,
        stroke: isColdAisle ? "rgba(0, 180, 216, 0.45)" : "rgba(251, 146, 60, 0.45)",
        accentStripe: isColdAisle ? "rgba(0, 180, 216, 0.5)" : "rgba(244, 63, 94, 0.45)",
      };
    }

    case "network": {
      const facilityNetRatio = clamp01(
        usage.bandwidthGbps / Math.max(1, infrastructure.effective.bandwidthGbps),
      );
      const localRatio = spec
        ? clamp01(spec.bandwidthGbps / 48)
        : facilityNetRatio * 0.4;
      const tint = mixHex("#0d2238", "#a855f7", 0.2 + localRatio * 0.62);
      return {
        fill: tint,
        stroke: "rgba(168, 85, 247, 0.42)",
        accentStripe: "rgba(34, 211, 238, 0.45)",
      };
    }

    case "maintenance": {
      if (rack?.health === "repairing") {
        return {
          fill: "#3d1220",
          stroke: "#ff4d6d",
          accentStripe: "rgba(255, 77, 109, 0.55)",
        };
      }
      if (maint && maint.failureProbability >= 0.15) {
        return {
          fill: "#36270c",
          stroke: "#ffb703",
          accentStripe: "rgba(255, 183, 3, 0.45)",
        };
      }
      return {
        fill: rack ? "#0b2e26" : "rgba(12, 32, 34, 0.85)",
        stroke: rack ? "#00f5a0" : "rgba(0, 245, 160, 0.22)",
        accentStripe: "rgba(0, 245, 160, 0.32)",
      };
    }
  }
}

function drawEmptySlotBrackets(
  ctx: CanvasRenderingContext2D,
  transform: CameraTransform,
  viewportWidth: number,
  viewportHeight: number,
  pos: number,
  row: number,
  opts: {
    hasActiveBrush: boolean;
    canPlace: boolean;
    isSelected: boolean;
    isHovered: boolean;
  },
): void {
  const showHighlight = opts.hasActiveBrush || opts.isSelected || opts.isHovered;
  const accent = opts.hasActiveBrush
    ? opts.canPlace
      ? "#00f5a0"
      : "#ff3b5c"
    : opts.isSelected || opts.isHovered
      ? "#00f5d4"
      : "rgba(100, 116, 139, 0.45)";

  const innerFill = opts.hasActiveBrush
    ? opts.canPlace
      ? "rgba(0, 245, 160, 0.16)"
      : "rgba(255, 59, 92, 0.18)"
    : opts.isSelected
      ? "rgba(0, 245, 212, 0.2)"
      : opts.isHovered
        ? "rgba(56, 189, 248, 0.14)"
        : "rgba(7, 13, 22, 0.45)";

  drawIsoTile(ctx, transform, viewportWidth, viewportHeight, {
    gx: pos + 0.14,
    gy: row + 0.14,
    gz: 0.005,
    sx: 0.72,
    sy: 0.72,
    fill: innerFill,
    stroke: accent,
    lineWidth: showHighlight ? 1.4 : 0.85,
    dashed: !opts.isSelected,
    glowColor: showHighlight ? accent : undefined,
    glowBlur: opts.isSelected ? 10 : 6,
  });

  // 4-post corner mounting bracket pads
  const postSize = 0.09;
  const corners: ReadonlyArray<readonly [number, number]> = [
    [pos + 0.14, row + 0.14],
    [pos + 0.77, row + 0.14],
    [pos + 0.77, row + 0.77],
    [pos + 0.14, row + 0.77],
  ];
  for (const [cx, cy] of corners) {
    drawIsoTile(ctx, transform, viewportWidth, viewportHeight, {
      gx: cx,
      gy: cy,
      gz: 0.008,
      sx: postSize,
      sy: postSize,
      fill: accent,
      stroke: null,
    });
  }
}

function queueOverheadCableTraySegment(
  queue: RenderQueueItem[],
  transform: CameraTransform,
  viewportWidth: number,
  viewportHeight: number,
  cols: number,
  rows: number,
  rotation: IsoRotation,
  ctx: CanvasRenderingContext2D,
  row: number,
  pos: number,
  rackSpec: RackSpec | undefined,
  overlayMode: InfoOverlayMode,
  timeSec: number,
): void {
  const depth = computeDepthKey(pos + 0.5, row + 0.5, 2.02, cols, rows, rotation, 8);
  const isNetworkLens = overlayMode === "network";

  queue.push({
    depth,
    draw: () => {
      const trayZ = 2.02;
      const railColor = isNetworkLens ? "#38bdf8" : "rgba(100, 116, 139, 0.58)";
      const fiberColor = rackSpec
        ? rackSpec.kind === "storage" || rackSpec.tier >= 2
          ? "#a855f7"
          : "#22d3ee"
        : "rgba(34, 211, 238, 0.28)";

      // Two parallel cable ladder rails
      for (const railGy of [row + 0.41, row + 0.59]) {
        drawIsoConduit(
          ctx,
          transform,
          viewportWidth,
          viewportHeight,
          [
            { gx: pos, gy: railGy, gz: trayZ },
            { gx: pos + 1, gy: railGy, gz: trayZ },
          ],
          {
            color: railColor,
            widthPx: 1.5,
            alpha: isNetworkLens ? 0.92 : 0.75,
          },
        );
      }

      // Cross rungs along ladder
      for (const rungGx of [pos + 0.25, pos + 0.75]) {
        drawIsoConduit(
          ctx,
          transform,
          viewportWidth,
          viewportHeight,
          [
            { gx: rungGx, gy: row + 0.41, gz: trayZ },
            { gx: rungGx, gy: row + 0.59, gz: trayZ },
          ],
          {
            color: railColor,
            widthPx: 1.1,
            alpha: 0.7,
          },
        );
      }

      // Glowing fiber optic trunk inside ladder
      const trunkPts: IsoPoint3D[] = [
        { gx: pos, gy: row + 0.5, gz: trayZ + 0.02 },
        { gx: pos + 1, gy: row + 0.5, gz: trayZ + 0.02 },
      ];
      drawIsoConduit(ctx, transform, viewportWidth, viewportHeight, trunkPts, {
        color: fiberColor,
        widthPx: isNetworkLens ? 2.4 : rackSpec ? 1.8 : 1.1,
        glowColor: rackSpec || isNetworkLens ? fiberColor : undefined,
        glowBlur: isNetworkLens ? 9 : 5,
        dashed: Boolean(rackSpec) || isNetworkLens,
        dashPattern: [5, 7],
        dashOffset: -(timeSec * 14 + pos * 3) % 24,
        alpha: rackSpec || isNetworkLens ? 0.92 : 0.45,
      });

      // Vertical fiber drop down to occupied rack roof
      if (rackSpec) {
        drawIsoConduit(
          ctx,
          transform,
          viewportWidth,
          viewportHeight,
          [
            { gx: pos + 0.5, gy: row + 0.5, gz: trayZ },
            { gx: pos + 0.5, gy: row + 0.5, gz: 0.9 + rackSpec.tier * 0.25 },
          ],
          {
            color: fiberColor,
            widthPx: 1.25,
            alpha: isNetworkLens ? 0.95 : 0.65,
          },
        );
      }
    },
  });
}

function queuePerimeterEquipment(
  queue: RenderQueueItem[],
  hitTargets: FloorHitTarget[],
  ctx: CanvasRenderingContext2D,
  transform: CameraTransform,
  viewportWidth: number,
  viewportHeight: number,
  cols: number,
  rows: number,
  input: FloorSceneInput,
): void {
  const rotation = input.camera.rotation;
  const coolingType = input.infrastructure.effective.coolingType;
  const hasCoolingTower = coolingType === "liquid" || coolingType === "hybrid";
  const onsiteKw = input.infrastructure.effective.onsiteGenerationCapacityKw;

  const isHoveredEquipment = (id: "crac" | "pdu" | "noc" | "generator") =>
    input.hoveredTarget?.kind === "equipment" && input.hoveredTarget.equipmentId === id;

  // 1. CRAC Cooling Bank (+ cylindrical coolant tower when liquid or hybrid) on North apron
  const cracSpanX = hasCoolingTower ? 1.98 : 1.46;
  const cracHitPoly = projectPrismSilhouette(
    0.25,
    -0.66,
    0,
    cracSpanX,
    0.48,
    hasCoolingTower ? 1.12 : 0.92,
    transform,
    viewportWidth,
    viewportHeight,
  );
  const cracHitDepth = computeDepthKey(
    0.25 + cracSpanX * 0.5,
    -0.42,
    0.45,
    cols,
    rows,
    rotation,
    2,
  );
  hitTargets.push({
    kind: "equipment",
    equipmentId: "crac",
    label: `CRAC Cooling (${coolingType.toUpperCase()})`,
    hitPolygon: cracHitPoly,
    depth: cracHitDepth,
  });

  const cracBays = [
    { gx: 0.25, sx: 0.7 },
    { gx: 1.0, sx: 0.7 },
  ];
  for (const bay of cracBays) {
    const bayDepth = computeDepthKey(bay.gx + bay.sx * 0.5, -0.42, 0.4, cols, rows, rotation, 2);
    queue.push({
      depth: bayDepth,
      draw: () => {
        const hovered = isHoveredEquipment("crac");
        const cracBox = drawIsoBox(ctx, transform, viewportWidth, viewportHeight, {
          gx: bay.gx,
          gy: -0.66,
          gz: 0,
          sx: bay.sx,
          sy: 0.48,
          hz: 0.88,
          topColor: hovered ? "#164e63" : "#163047",
          leftColor: "#0d1f30",
          rightColor: "#11283d",
          strokeColor: hovered || input.overlayMode === "thermal" ? "#00b4d8" : "#2b5278",
          lineWidth: hovered ? 1.7 : 1.0,
          glowColor: hovered || input.overlayMode === "thermal" ? "#00b4d8" : undefined,
          glowBlur: hovered ? 12 : 7,
          topHighlight: "#7dd3fc",
        });
        drawIsoWindowGrid(
          ctx,
          cracBox.frontLeftQuad,
          3,
          2,
          (r) => (r === 0 ? "#00b4d8" : "rgba(15, 23, 42, 0.75)"),
          0.16,
          0.18,
        );
        drawIsoWindowGrid(
          ctx,
          cracBox.frontRightQuad,
          3,
          2,
          (r) => (r === 0 ? "#38bdf8" : "rgba(15, 23, 42, 0.75)"),
          0.16,
          0.18,
        );
      },
    });
  }

  if (hasCoolingTower) {
    const towerGx = 2.01;
    const towerGy = -0.42;
    const towerDepth = computeDepthKey(towerGx, towerGy, 0.55, cols, rows, rotation, 3);
    queue.push({
      depth: towerDepth,
      draw: () => {
        drawIsoCylinder(ctx, transform, viewportWidth, viewportHeight, {
          gx: towerGx,
          gy: towerGy,
          gz: 0,
          radius: 0.21,
          height: coolingType === "liquid" ? 1.12 : 0.96,
          topColor: coolingType === "liquid" ? "#0ea5e9" : "#22d3ee",
          sideLeftColor: "#0c2d48",
          sideRightColor: "#164e63",
          strokeColor: "#67e8f9",
        });
        if (isHoveredEquipment("crac") || input.overlayMode === "thermal") {
          const anchor = projectIso(
            { gx: 1.15, gy: -0.42, gz: 1.25 },
            transform,
            viewportWidth,
            viewportHeight,
          );
          drawIsoBadge(ctx, anchor, `CRAC · ${coolingType.toUpperCase()}`, {
            border: "#00b4d8",
            textColor: "#67e8f9",
            fontSizePx: 9,
          });
        }
      },
    });
  } else {
    queue.push({
      depth: cracHitDepth + 1,
      draw: () => {
        if (isHoveredEquipment("crac") || input.overlayMode === "thermal") {
          const anchor = projectIso(
            { gx: 0.98, gy: -0.42, gz: 1.05 },
            transform,
            viewportWidth,
            viewportHeight,
          );
          drawIsoBadge(ctx, anchor, "CRAC · AIR", {
            border: "#00b4d8",
            textColor: "#67e8f9",
            fontSizePx: 9,
          });
        }
      },
    });
  }

  // 2. Main PDU Switchgear Cabinet Wall on West apron
  const pduHitPoly = projectPrismSilhouette(
    -0.66,
    0.14,
    0,
    0.48,
    1.52,
    0.98,
    transform,
    viewportWidth,
    viewportHeight,
  );
  const pduDepth = computeDepthKey(-0.42, 0.9, 0.45, cols, rows, rotation, 2);
  hitTargets.push({
    kind: "equipment",
    equipmentId: "pdu",
    label: "Main PDU Switchgear",
    hitPolygon: pduHitPoly,
    depth: pduDepth,
  });

  const pduCabinets = [
    { gy: 0.14, sy: 0.72 },
    { gy: 0.94, sy: 0.72 },
  ];
  for (const cab of pduCabinets) {
    const cabDepth = computeDepthKey(-0.42, cab.gy + cab.sy * 0.5, 0.45, cols, rows, rotation, 2);
    queue.push({
      depth: cabDepth,
      draw: () => {
        const hovered = isHoveredEquipment("pdu");
        const cabBox = drawIsoBox(ctx, transform, viewportWidth, viewportHeight, {
          gx: -0.66,
          gy: cab.gy,
          gz: 0,
          sx: 0.48,
          sy: cab.sy,
          hz: 0.96,
          topColor: hovered ? "#52350c" : "#2f2414",
          leftColor: "#1b140a",
          rightColor: "#241b0f",
          strokeColor: hovered || input.overlayMode === "power" ? "#f59e0b" : "#78531b",
          lineWidth: hovered ? 1.7 : 1.0,
          glowColor: hovered || input.overlayMode === "power" ? "#f59e0b" : undefined,
          glowBlur: hovered ? 12 : 7,
          topHighlight: "#fcd34d",
        });
        drawIsoWindowGrid(
          ctx,
          cabBox.frontRightQuad,
          3,
          2,
          (r, c) => (r === 0 && c === 0 ? "#22c55e" : "#f59e0b"),
          0.2,
          0.18,
        );
        drawFaceRect(ctx, cabBox.frontLeftQuad, 0.2, 0.15, 0.8, 0.85, "rgba(15, 23, 42, 0.72)");
      },
    });
  }
  queue.push({
    depth: pduDepth + 1,
    draw: () => {
      if (isHoveredEquipment("pdu") || input.overlayMode === "power") {
        const anchor = projectIso(
          { gx: -0.42, gy: 0.9, gz: 1.1 },
          transform,
          viewportWidth,
          viewportHeight,
        );
        drawIsoBadge(
          ctx,
          anchor,
          `PDU · ${Math.round(input.infrastructure.effective.rackPowerCapacityKw)}kW`,
          {
            border: "#f59e0b",
            textColor: "#fcd34d",
            fontSizePx: 9,
          },
        );
      }
    },
  });

  // 3. NOC Operations Desk with glowing telemetry screens on South apron
  const nocGx = 0.25;
  const nocGy = rows + 0.16;
  const nocSx = 1.4;
  const nocSy = 0.48;
  const nocHitPoly = projectPrismSilhouette(
    nocGx,
    nocGy,
    0,
    nocSx,
    nocSy,
    0.72,
    transform,
    viewportWidth,
    viewportHeight,
  );
  const nocDepth = computeDepthKey(
    nocGx + nocSx * 0.5,
    nocGy + nocSy * 0.5,
    0.3,
    cols,
    rows,
    rotation,
    2,
  );
  hitTargets.push({
    kind: "equipment",
    equipmentId: "noc",
    label: "NOC Monitoring Desk",
    hitPolygon: nocHitPoly,
    depth: nocDepth,
  });

  queue.push({
    depth: nocDepth,
    draw: () => {
      const hovered = isHoveredEquipment("noc");
      // Raised operator platform
      drawIsoBox(ctx, transform, viewportWidth, viewportHeight, {
        gx: nocGx,
        gy: nocGy,
        gz: 0,
        sx: nocSx,
        sy: nocSy,
        hz: 0.14,
        topColor: "#1b283c",
        leftColor: "#101827",
        rightColor: "#152134",
        strokeColor: hovered ? "#00f5d4" : "#334155",
        lineWidth: hovered ? 1.5 : 0.9,
      });

      // Operator console desk
      drawIsoBox(ctx, transform, viewportWidth, viewportHeight, {
        gx: nocGx + 0.12,
        gy: nocGy + 0.1,
        gz: 0.14,
        sx: nocSx - 0.24,
        sy: nocSy - 0.2,
        hz: 0.26,
        topColor: "#23354f",
        leftColor: "#121e30",
        rightColor: "#192940",
        strokeColor: hovered ? "#00f5d4" : "#475569",
        lineWidth: 0.9,
      });

      // Glowing telemetry screen array
      const screenWall = drawIsoBox(ctx, transform, viewportWidth, viewportHeight, {
        gx: nocGx + 0.18,
        gy: nocGy + 0.14,
        gz: 0.4,
        sx: nocSx - 0.36,
        sy: 0.08,
        hz: 0.3,
        topColor: "#0f172a",
        leftColor: "#08121f",
        rightColor: "#0c192b",
        strokeColor: "#00f5d4",
        lineWidth: 1,
        glowColor: "#00f5d4",
        glowBlur: hovered ? 14 : 7,
      });

      const pulse = 0.5 + 0.5 * Math.sin(input.timeSec * 3.2);
      for (const quad of [screenWall.frontLeftQuad, screenWall.frontRightQuad]) {
        drawIsoWindowGrid(
          ctx,
          quad,
          2,
          4,
          (r, c) => {
            if (r === 0 && c % 2 === 0) return pulse > 0.45 ? "#00f5d4" : "#0ea5e9";
            if (r === 1 && c === 3) return "#a855f7";
            return "#38bdf8";
          },
          0.1,
          0.14,
        );
      }

      if (hovered || input.overlayMode === "network") {
        const anchor = projectIso(
          { gx: nocGx + nocSx * 0.5, gy: nocGy + nocSy * 0.5, gz: 0.85 },
          transform,
          viewportWidth,
          viewportHeight,
        );
        drawIsoBadge(
          ctx,
          anchor,
          `NOC · ${input.infrastructure.effective.networkType.toUpperCase()}`,
          {
            border: "#00f5d4",
            textColor: "#72ffea",
            fontSizePx: 9,
          },
        );
      }
    },
  });

  // 4. Onsite Generator Unit with exhaust stacks when onsiteGenerationCapacityKw > 0
  if (onsiteKw > 0) {
    const genGx = cols + 0.16;
    const genGy = 0.16;
    const genSx = 0.5;
    const genSy = 1.48;
    const genHitPoly = projectPrismSilhouette(
      genGx,
      genGy,
      0,
      genSx,
      genSy,
      1.18,
      transform,
      viewportWidth,
      viewportHeight,
    );
    const genDepth = computeDepthKey(
      genGx + genSx * 0.5,
      genGy + genSy * 0.5,
      0.45,
      cols,
      rows,
      rotation,
      2,
    );
    hitTargets.push({
      kind: "equipment",
      equipmentId: "generator",
      label: `Onsite Generator (${Math.round(onsiteKw)} kW)`,
      hitPolygon: genHitPoly,
      depth: genDepth,
    });

    queue.push({
      depth: genDepth,
      draw: () => {
        const hovered = isHoveredEquipment("generator");
        const genBox = drawIsoBox(ctx, transform, viewportWidth, viewportHeight, {
          gx: genGx,
          gy: genGy,
          gz: 0,
          sx: genSx,
          sy: genSy,
          hz: 0.78,
          topColor: hovered ? "#4b3b14" : "#2c2516",
          leftColor: "#1b170e",
          rightColor: "#241e13",
          strokeColor: hovered || input.overlayMode === "power" ? "#f59e0b" : "#785a1c",
          lineWidth: hovered ? 1.6 : 1.0,
          glowColor: hovered || input.overlayMode === "power" ? "#f59e0b" : undefined,
          glowBlur: hovered ? 12 : 6,
          topHighlight: "#fde68a",
        });

        drawFaceRect(ctx, genBox.frontLeftQuad, 0.12, 0.76, 0.88, 0.88, "#f59e0b");
        drawIsoWindowGrid(
          ctx,
          genBox.frontRightQuad,
          3,
          3,
          (r) => (r === 0 ? "#fcd34d" : "rgba(15, 23, 42, 0.72)"),
          0.16,
          0.16,
        );

        // Twin cylindrical exhaust stacks
        for (const stackGy of [genGy + 0.38, genGy + 1.08]) {
          drawIsoCylinder(ctx, transform, viewportWidth, viewportHeight, {
            gx: genGx + 0.25,
            gy: stackGy,
            gz: 0.78,
            radius: 0.09,
            height: 0.38,
            topColor: "#94a3b8",
            sideLeftColor: "#334155",
            sideRightColor: "#64748b",
            strokeColor: "#cbd5e1",
          });
        }

        if (hovered || input.overlayMode === "power") {
          const anchor = projectIso(
            { gx: genGx + genSx * 0.5, gy: genGy + genSy * 0.5, gz: 1.28 },
            transform,
            viewportWidth,
            viewportHeight,
          );
          drawIsoBadge(ctx, anchor, `GEN · +${Math.round(onsiteKw)}kW`, {
            border: "#f59e0b",
            textColor: "#fde68a",
            fontSizePx: 9,
          });
        }
      },
    });
  }
}

function queueMaintenanceTechnicians(
  queue: RenderQueueItem[],
  ctx: CanvasRenderingContext2D,
  transform: CameraTransform,
  viewportWidth: number,
  viewportHeight: number,
  cols: number,
  rows: number,
  input: FloorSceneInput,
): void {
  const techCount = Math.min(6, Math.max(0, Math.floor(input.datacenter.maintenanceStaff)));
  if (techCount === 0) return;

  const repairingRacks = input.datacenter.placements.filter((p) => p.health === "repairing");
  const rotation = input.camera.rotation;

  for (let i = 0; i < techCount; i++) {
    const repairingRack = repairingRacks.length > 0 ? repairingRacks[i % repairingRacks.length] : undefined;
    const isRepairingAssigned = repairingRack !== undefined && i < repairingRacks.length;

    let techGx: number;
    let techGy: number;
    let bobZ: number;

    if (isRepairingAssigned && repairingRack) {
      techGx = repairingRack.position + 0.5 + Math.sin(input.timeSec * 3.1 + i) * 0.06;
      techGy = repairingRack.row + (repairingRack.row % 2 === 0 ? 0.05 : 0.95);
      bobZ = Math.abs(Math.sin(input.timeSec * 5 + i)) * 0.015;
    } else {
      const patrolLane = i % (rows + 1);
      const phase = input.timeSec * (0.42 + (i % 3) * 0.12) + i * 1.37;
      const triangle = 1 - Math.abs((phase % 2) - 1);
      techGx = 0.25 + triangle * Math.max(0.5, cols - 0.5);
      techGy = patrolLane;
      bobZ = Math.abs(Math.sin(input.timeSec * 7 + i)) * 0.025;
    }

    const depth = computeDepthKey(techGx, techGy, 0.2, cols, rows, rotation, 4);
    queue.push({
      depth,
      draw: () => {
        // Floor shadow
        drawIsoTile(ctx, transform, viewportWidth, viewportHeight, {
          gx: techGx - 0.08,
          gy: techGy - 0.08,
          gz: 0.012,
          sx: 0.16,
          sy: 0.16,
          fill: "rgba(2, 6, 15, 0.55)",
          stroke: null,
        });

        // Legs / boots
        drawIsoBox(ctx, transform, viewportWidth, viewportHeight, {
          gx: techGx - 0.06,
          gy: techGy - 0.06,
          gz: 0.01 + bobZ,
          sx: 0.12,
          sy: 0.12,
          hz: 0.14,
          topColor: "#1e293b",
          leftColor: "#0f172a",
          rightColor: "#172133",
        });

        // Hi-vis safety vest torso
        drawIsoBox(ctx, transform, viewportWidth, viewportHeight, {
          gx: techGx - 0.075,
          gy: techGy - 0.075,
          gz: 0.15 + bobZ,
          sx: 0.15,
          sy: 0.15,
          hz: 0.18,
          topColor: isRepairingAssigned ? "#fb923c" : "#f59e0b",
          leftColor: "#b45309",
          rightColor: "#d97706",
          strokeColor: "#fef3c7",
          lineWidth: 0.6,
        });

        // Hard hat / helmet head
        drawIsoBox(ctx, transform, viewportWidth, viewportHeight, {
          gx: techGx - 0.055,
          gy: techGy - 0.055,
          gz: 0.33 + bobZ,
          sx: 0.11,
          sy: 0.11,
          hz: 0.11,
          topColor: isRepairingAssigned ? "#00f5d4" : "#f8fafc",
          leftColor: "#94a3b8",
          rightColor: "#cbd5e1",
          strokeColor: isRepairingAssigned ? "#72ffea" : "#e2e8f0",
          lineWidth: 0.6,
          glowColor: isRepairingAssigned ? "#ffb703" : undefined,
          glowBlur: isRepairingAssigned ? 8 : 0,
        });

        if (isRepairingAssigned) {
          const sparkAnchor = projectIso(
            { gx: techGx, gy: techGy, gz: 0.36 + bobZ },
            transform,
            viewportWidth,
            viewportHeight,
          );
          ctx.save();
          ctx.fillStyle = Math.sin(input.timeSec * 14 + i) > 0 ? "#fde047" : "#fb923c";
          ctx.globalAlpha = 0.85;
          ctx.beginPath();
          ctx.arc(sparkAnchor.x, sparkAnchor.y, 2.2 * transform.zoom, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      },
    });
  }
}

export function renderFloorScene(
  ctx: CanvasRenderingContext2D,
  viewportWidth: number,
  viewportHeight: number,
  input: FloorSceneInput,
): FloorHitTarget[] {
  const cols = input.datacenter.spec.positionsPerRow;
  const rows = input.datacenter.spec.rows;
  const transform = toCameraTransform(input.camera, cols, rows);

  drawBackdrop(ctx, viewportWidth, viewportHeight);
  drawFoundationSlabAndPlenum(ctx, transform, viewportWidth, viewportHeight, cols, rows, input);
  drawCutawayBackWalls(ctx, transform, viewportWidth, viewportHeight, cols, rows, input.camera);

  const placementByCell = new Map<string, RackPlacement>();
  for (const placement of input.datacenter.placements) {
    placementByCell.set(`${placement.row},${placement.position}`, placement);
  }

  const activityById = new Map<RackPlacementId, RackActivityView>();
  for (const act of input.rackActivities) {
    activityById.set(act.placementId, act);
  }

  const maintenanceById = new Map<RackPlacementId, DatacenterRackMaintenanceStatusView>();
  for (const m of input.rackMaintenance) {
    maintenanceById.set(m.placementId, m);
  }

  const activeSpec = input.activeRackSpecId ? RACK_CATALOG[input.activeRackSpecId] : undefined;
  const hitTargets: FloorHitTarget[] = [];
  const renderQueue: RenderQueueItem[] = [];

  // Floor grid & slot tiles
  for (let row = 0; row < rows; row++) {
    for (let pos = 0; pos < cols; pos++) {
      const cellKey = `${row},${pos}`;
      const placement = placementByCell.get(cellKey);
      const activity = placement ? activityById.get(placement.id) : undefined;
      const maint = placement ? maintenanceById.get(placement.id) : undefined;

      const tileColors = resolveFloorTileColors(
        row,
        placement,
        activity,
        maint,
        input.usage,
        input.infrastructure,
        input.overlayMode,
      );

      const tileQuad = drawIsoTile(ctx, transform, viewportWidth, viewportHeight, {
        gx: pos,
        gy: row,
        gz: 0,
        sx: 1,
        sy: 1,
        fill: tileColors.fill,
        stroke: tileColors.stroke,
        lineWidth: 0.9,
      });

      // Cold/hot aisle edge strip indicator
      if (tileQuad.length === 4 && transform.zoom >= 0.5) {
        const pStart = bilerpQuad(
          tileQuad as [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint],
          0.12,
          0.08,
        );
        const pEnd = bilerpQuad(
          tileQuad as [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint],
          0.88,
          0.08,
        );
        ctx.save();
        ctx.strokeStyle = tileColors.accentStripe;
        ctx.lineWidth = Math.max(1, 1.8 * transform.zoom);
        ctx.beginPath();
        ctx.moveTo(pStart.x, pStart.y);
        ctx.lineTo(pEnd.x, pEnd.y);
        ctx.stroke();
        ctx.restore();
      }

      if (!placement) {
        const isSelectedSlot =
          input.selectedSlot !== null &&
          input.selectedSlot.row === row &&
          input.selectedSlot.position === pos;
        const isHoveredSlot =
          input.hoveredTarget?.kind === "slot" &&
          input.hoveredTarget.row === row &&
          input.hoveredTarget.position === pos;

        let canPlace = true;
        let blockReason: PlacementFailureReason | undefined;

        if (input.activeRackSpecId) {
          if (input.canPlaceAtSlot) {
            const check = input.canPlaceAtSlot(row, pos, input.activeRackSpecId);
            canPlace = check.ok;
            blockReason = check.reason;
          } else if (activeSpec) {
            const check = canPlaceRack(input.datacenter, activeSpec, { row, position: pos });
            canPlace = check.ok;
            if (!check.ok) {
              blockReason = check.reason;
            }
          }
        }

        drawEmptySlotBrackets(ctx, transform, viewportWidth, viewportHeight, pos, row, {
          hasActiveBrush: Boolean(input.activeRackSpecId),
          canPlace,
          isSelected: isSelectedSlot,
          isHovered: isHoveredSlot,
        });

        const slotDepth = computeDepthKey(
          pos + 0.5,
          row + 0.5,
          0,
          cols,
          rows,
          input.camera.rotation,
          0,
        );
        hitTargets.push({
          kind: "slot",
          row,
          position: pos,
          canPlace,
          ...(blockReason ? { blockReason } : {}),
          hitPolygon: tileQuad,
          depth: slotDepth,
        });

        // Ghost rack preview on hovered empty slot when activeRackSpecId is set
        if (isHoveredSlot && activeSpec) {
          const ghostDepth = computeDepthKey(
            pos + 0.5,
            row + 0.5,
            0.4,
            cols,
            rows,
            input.camera.rotation,
            2,
          );
          renderQueue.push({
            depth: ghostDepth,
            draw: () => {
              drawProceduralRack3D(ctx, transform, viewportWidth, viewportHeight, {
                gx: pos,
                gy: row,
                spec: activeSpec,
                activityStatus: "idle",
                health: "healthy",
                repairCompletionPercent: 100,
                failureProbability: 0,
                billedPowerKw: 0,
                isSelected: false,
                isHovered: true,
                isGhost: true,
                ghostValid: canPlace,
                overlayMode: input.overlayMode,
                timeSec: input.timeSec,
              });
            },
          });
        }

        queueOverheadCableTraySegment(
          renderQueue,
          transform,
          viewportWidth,
          viewportHeight,
          cols,
          rows,
          input.camera.rotation,
          ctx,
          row,
          pos,
          undefined,
          input.overlayMode,
          input.timeSec,
        );
      } else {
        const rackSpec = RACK_CATALOG[placement.specId];
        if (!rackSpec) continue;

        const rackDepth = computeDepthKey(
          pos + 0.5,
          row + 0.5,
          0.4,
          cols,
          rows,
          input.camera.rotation,
          2,
        );
        const activityStatus: RackActivityStatus =
          activity?.status ?? (placement.health === "repairing" ? "repairing" : "idle");
        const billedPowerKw = activity?.billedPowerKw ?? 0;
        const repairCompletionPercent =
          maint?.repairCompletionPercent ?? (placement.health === "healthy" ? 100 : 0);
        const failureProbability = maint?.failureProbability ?? 0;
        const isSelected = input.selectedPlacementId === placement.id;
        const isHovered =
          input.hoveredTarget?.kind === "rack" &&
          input.hoveredTarget.placementId === placement.id;

        const rackHitPolygon = projectPrismSilhouette(
          pos + (rackSpec.tier >= 3 ? 0.1 : 0.13),
          row + (rackSpec.tier >= 3 ? 0.1 : 0.13),
          0,
          1 - (rackSpec.tier >= 3 ? 0.2 : 0.26),
          1 - (rackSpec.tier >= 3 ? 0.2 : 0.26),
          0.92 + rackSpec.tier * 0.32 + (rackSpec.kind === "gpu" ? 0.1 : 0),
          transform,
          viewportWidth,
          viewportHeight,
        );

        hitTargets.push({
          kind: "rack",
          placementId: placement.id,
          row,
          position: pos,
          specId: placement.specId,
          hitPolygon: rackHitPolygon,
          depth: rackDepth,
        });

        renderQueue.push({
          depth: rackDepth,
          draw: () => {
            drawProceduralRack3D(ctx, transform, viewportWidth, viewportHeight, {
              gx: pos,
              gy: row,
              spec: rackSpec,
              activityStatus,
              health: placement.health,
              repairCompletionPercent,
              failureProbability,
              billedPowerKw,
              isSelected,
              isHovered,
              overlayMode: input.overlayMode,
              timeSec: input.timeSec,
              seedOffset: (row * 31 + pos * 17) * 0.37,
            });
          },
        });

        queueOverheadCableTraySegment(
          renderQueue,
          transform,
          viewportWidth,
          viewportHeight,
          cols,
          rows,
          input.camera.rotation,
          ctx,
          row,
          pos,
          rackSpec,
          input.overlayMode,
          input.timeSec,
        );
      }
    }
  }

  queuePerimeterEquipment(
    renderQueue,
    hitTargets,
    ctx,
    transform,
    viewportWidth,
    viewportHeight,
    cols,
    rows,
    input,
  );
  queueMaintenanceTechnicians(
    renderQueue,
    ctx,
    transform,
    viewportWidth,
    viewportHeight,
    cols,
    rows,
    input,
  );

  renderQueue.sort((a, b) => a.depth - b.depth);
  for (const item of renderQueue) {
    item.draw();
  }

  return hitTargets;
}
