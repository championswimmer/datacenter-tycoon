import type {
  RackActivityStatus,
  RackHealthStatus,
  RackKind,
  RackSpec,
  RackTier,
} from "@datacenter-tycoon/game-logic";
import type { CameraTransform, ScreenPoint } from "./isoMath.js";
import {
  bilerpQuad,
  drawFaceRect,
  drawIsoBadge,
  drawIsoBox,
  drawIsoCylinder,
  drawIsoTile,
  drawIsoWindowGrid,
  mixHex,
} from "./primitives3d.js";

export type InfoOverlayMode = "standard" | "power" | "thermal" | "network" | "maintenance";

export interface RackKindPalette {
  accent: string;
  accentBright: string;
  topBase: string;
  frontBase: string;
  sideBase: string;
  badgeText: string;
}

export const RACK_KIND_PALETTES: Record<RackKind, RackKindPalette> = {
  compute: {
    accent: "#00f5d4",
    accentBright: "#72ffea",
    topBase: "#1e2e40",
    frontBase: "#101b29",
    sideBase: "#162334",
    badgeText: "COMPUTE",
  },
  memory: {
    accent: "#3b82f6",
    accentBright: "#93c5fd",
    topBase: "#1e2c45",
    frontBase: "#10192b",
    sideBase: "#152238",
    badgeText: "MEMORY",
  },
  storage: {
    accent: "#a855f7",
    accentBright: "#d8b4fe",
    topBase: "#272340",
    frontBase: "#141126",
    sideBase: "#1c1833",
    badgeText: "STORAGE",
  },
  gpu: {
    accent: "#f59e0b",
    accentBright: "#fcd34d",
    topBase: "#2d261f",
    frontBase: "#191512",
    sideBase: "#221c17",
    badgeText: "GPU",
  },
};

export interface RackRenderParams {
  gx: number;
  gy: number;
  gz?: number;
  spec: RackSpec;
  activityStatus: RackActivityStatus;
  health: RackHealthStatus;
  repairCompletionPercent: number;
  failureProbability: number;
  billedPowerKw: number;
  isSelected: boolean;
  isHovered: boolean;
  isGhost?: boolean;
  ghostValid?: boolean;
  overlayMode: InfoOverlayMode;
  timeSec: number;
  seedOffset?: number;
}

export interface RenderedRackBounds {
  hitPolygon: ScreenPoint[];
  roofAnchor: ScreenPoint;
  heightUnits: number;
}

/** Deterministic physical height (world Z units) by tier & rack kind. */
export function rackHeightByTier(tier: RackTier, kind: RackKind): number {
  const baseByTier: Record<RackTier, number> = {
    0: 0.92,
    1: 1.28,
    2: 1.56,
    3: 1.88,
  };
  return baseByTier[tier] + (kind === "gpu" ? 0.1 : 0);
}

/** Compute Info-Lens tinting for a single rack. */
export function resolveRackOverlayColors(params: RackRenderParams): {
  topColor: string;
  leftColor: string;
  rightColor: string;
  accent: string;
  overlayLabel: string | null;
} {
  const palette = RACK_KIND_PALETTES[params.spec.kind];

  if (params.isGhost) {
    const valid = params.ghostValid !== false;
    const tint = valid ? "#00f5a0" : "#ff3b5c";
    return {
      topColor: valid ? "rgba(0, 245, 160, 0.32)" : "rgba(255, 59, 92, 0.34)",
      leftColor: valid ? "rgba(0, 180, 120, 0.25)" : "rgba(200, 40, 70, 0.28)",
      rightColor: valid ? "rgba(0, 210, 140, 0.28)" : "rgba(220, 48, 80, 0.30)",
      accent: tint,
      overlayLabel: valid ? params.spec.id : "BLOCKED",
    };
  }

  switch (params.overlayMode) {
    case "standard": {
      if (params.health === "repairing") {
        return {
          topColor: "#33281d",
          leftColor: "#1d1712",
          rightColor: "#271e16",
          accent: "#ffb703",
          overlayLabel: `${params.repairCompletionPercent}%`,
        };
      }
      return {
        topColor: palette.topBase,
        leftColor: palette.frontBase,
        rightColor: palette.sideBase,
        accent: palette.accent,
        overlayLabel: null,
      };
    }

    case "power": {
      const loadRatio = Math.min(1, params.billedPowerKw / Math.max(1, params.spec.powerDrawKw));
      const hue = mixHex("#0ea5e9", loadRatio > 0.72 ? "#ff4d6d" : "#ffb703", loadRatio);
      return {
        topColor: mixHex("#1f2937", hue, 0.62),
        leftColor: mixHex("#111827", hue, 0.45),
        rightColor: mixHex("#162030", hue, 0.54),
        accent: hue,
        overlayLabel: `${params.billedPowerKw.toFixed(1)}kW`,
      };
    }

    case "thermal": {
      const heatRatio = Math.min(
        1,
        (params.activityStatus === "active" ? 0.45 : 0.12) + params.spec.tier * 0.16 + (params.spec.kind === "gpu" ? 0.14 : 0),
      );
      const thermalHue = mixHex("#38bdf8", heatRatio > 0.65 ? "#f43f5e" : "#fb923c", heatRatio);
      return {
        topColor: mixHex("#1b2636", thermalHue, 0.68),
        leftColor: mixHex("#101824", thermalHue, 0.5),
        rightColor: mixHex("#152030", thermalHue, 0.58),
        accent: thermalHue,
        overlayLabel: `${Math.round(params.spec.heatOutputBtuPerHr / 1000)}k BTU`,
      };
    }

    case "network": {
      const bwRatio = Math.min(1, params.spec.bandwidthGbps / 100);
      const netHue = mixHex("#22d3ee", "#a855f7", bwRatio);
      return {
        topColor: mixHex("#172335", netHue, 0.6),
        leftColor: mixHex("#0f1724", netHue, 0.45),
        rightColor: mixHex("#131e2f", netHue, 0.52),
        accent: netHue,
        overlayLabel: `${params.spec.bandwidthGbps}G`,
      };
    }

    case "maintenance": {
      const healthColor =
        params.health === "repairing"
          ? "#ff4d6d"
          : params.failureProbability >= 0.15
            ? "#ffb703"
            : "#00f5a0";
      return {
        topColor: mixHex("#1e293b", healthColor, 0.64),
        leftColor: mixHex("#111827", healthColor, 0.48),
        rightColor: mixHex("#172132", healthColor, 0.56),
        accent: healthColor,
        overlayLabel:
          params.health === "repairing"
            ? `FIX ${params.repairCompletionPercent}%`
            : `${Math.round(params.failureProbability * 100)}% RISK`,
      };
    }
  }
}

/**
 * Render a detailed procedural 3D server rack onto Canvas 2D with tier-specific
 * industrial silhouettes, directional front/rear panel details, animated LED
 * telemetry, repair sparks, and selection/hover highlights.
 */
export function drawProceduralRack3D(
  ctx: CanvasRenderingContext2D,
  camera: CameraTransform,
  viewportWidth: number,
  viewportHeight: number,
  params: RackRenderParams,
): RenderedRackBounds {
  const margin = params.spec.tier >= 3 ? 0.1 : 0.13;
  const gx = params.gx + margin;
  const gy = params.gy + margin;
  const gz = params.gz ?? 0;
  const sx = 1 - margin * 2;
  const sy = 1 - margin * 2;
  const hz = rackHeightByTier(params.spec.tier, params.spec.kind);

  const colors = resolveRackOverlayColors(params);
  const pulse = 0.5 + 0.5 * Math.sin(params.timeSec * 3.8 + (params.seedOffset ?? 0));

  // Floor contact plinth or selection glow
  if (params.isSelected || params.isHovered || params.isGhost) {
    drawIsoTile(ctx, camera, viewportWidth, viewportHeight, {
      gx: params.gx + 0.05,
      gy: params.gy + 0.05,
      gz: gz + 0.01,
      sx: 0.9,
      sy: 0.9,
      fill: params.isSelected
        ? "rgba(0, 245, 212, 0.24)"
        : params.isGhost
          ? "rgba(0, 245, 160, 0.16)"
          : "rgba(114, 255, 234, 0.14)",
      stroke: params.isSelected ? "#00f5d4" : colors.accent,
      lineWidth: params.isSelected ? 2 : 1.3,
      glowColor: colors.accent,
      glowBlur: params.isSelected ? 14 : 8,
    });
  }

  // Main rack chassis
  const strokeColor = params.isSelected
    ? "#ffffff"
    : params.isGhost
      ? colors.accent
      : mixHex(colors.accent, "#1e293b", 0.58);

  const box = drawIsoBox(ctx, camera, viewportWidth, viewportHeight, {
    gx,
    gy,
    gz,
    sx,
    sy,
    hz,
    topColor: colors.topColor,
    leftColor: colors.leftColor,
    rightColor: colors.rightColor,
    strokeColor,
    lineWidth: params.isSelected ? 1.8 : 1.0,
    alpha: params.isGhost ? 0.72 : 1,
    glowColor: params.isSelected ? colors.accent : undefined,
    glowBlur: params.isSelected ? 14 : 0,
    topHighlight: params.isGhost ? undefined : mixHex(colors.accent, "#ffffff", 0.35),
  });

  if (!params.isGhost) {
    // Front glass & blade telemetry always appears on cardinal "S" and "E" depending on rotation,
    // while "N" and "W" show rear exhaust mesh & dual copper/power trunk bars.
    const isFrontQuad = (cardinal: "N" | "S" | "E" | "W") => cardinal === "S" || cardinal === "E";

    const renderFaceDetails = (
      quad: readonly [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint],
      cardinal: "N" | "S" | "E" | "W",
    ) => {
      if (isFrontQuad(cardinal)) {
        // Recessed cabinet bezel
        drawFaceRect(ctx, quad, 0.09, 0.08, 0.91, 0.94, "rgba(4, 8, 15, 0.65)", "rgba(255,255,255,0.08)");

        const bladeRows = 3 + params.spec.tier * 2;
        const ledCols = params.spec.tier >= 2 ? 3 : 2;
        drawIsoWindowGrid(
          ctx,
          quad,
          bladeRows,
          ledCols,
          (r, c) => {
            if (params.health === "repairing") {
              return r % 2 === 0 && c === 0 ? "#ffb703" : "rgba(255, 77, 109, 0.25)";
            }
            if (params.activityStatus === "active") {
              const phase = Math.floor(params.timeSec * 4 + r * 1.7 + c * 2.3 + (params.seedOffset ?? 0));
              return phase % 3 === 0 ? "#ffffff" : colors.accent;
            }
            // Idle standby: soft breathing indicator on top blade only
            if (r === 0 && c === 0) {
              return pulse > 0.45 ? colors.accent : "#1e3a5f";
            }
            return "rgba(148, 163, 184, 0.16)";
          },
          0.16,
          0.14,
        );
      } else {
        // Rear door: perforated exhaust slats & power distribution strip
        drawFaceRect(ctx, quad, 0.12, 0.1, 0.88, 0.9, "rgba(8, 14, 24, 0.72)");
        drawFaceRect(ctx, quad, 0.16, 0.14, 0.26, 0.86, mixHex(colors.accent, "#334155", 0.55));
        drawIsoWindowGrid(
          ctx,
          quad,
          4 + params.spec.tier,
          2,
          (_r, c) => (c === 1 ? "rgba(56, 189, 248, 0.22)" : "rgba(15, 23, 42, 0.7)"),
          0.3,
          0.16,
        );
      }
    };

    renderFaceDetails(box.frontLeftQuad, box.frontLeftCardinal);
    renderFaceDetails(box.frontRightQuad, box.frontRightCardinal);

    // Tier 2 & Tier 3 architectural roof equipment (cooling manifold crown / GPU liquid loop pods)
    if (params.spec.tier >= 2) {
      drawIsoBox(ctx, camera, viewportWidth, viewportHeight, {
        gx: gx + 0.12,
        gy: gy + 0.12,
        gz: gz + hz,
        sx: sx - 0.24,
        sy: sy - 0.24,
        hz: params.spec.tier === 3 ? 0.22 : 0.12,
        topColor: mixHex(colors.topColor, colors.accent, 0.32),
        leftColor: colors.leftColor,
        rightColor: colors.rightColor,
        strokeColor: colors.accent,
        lineWidth: 0.9,
      });
    }

    if (params.spec.tier === 3 && params.spec.kind === "gpu") {
      // Twin cylindrical liquid-cooling manifold reservoirs atop T3 GPU racks
      drawIsoCylinder(ctx, camera, viewportWidth, viewportHeight, {
        gx: params.gx + 0.35,
        gy: params.gy + 0.35,
        gz: gz + hz + 0.22,
        radius: 0.14,
        height: 0.24,
        topColor: "#fcd34d",
        sideLeftColor: "#78350f",
        sideRightColor: "#d97706",
        strokeColor: "#fef3c7",
      });
      drawIsoCylinder(ctx, camera, viewportWidth, viewportHeight, {
        gx: params.gx + 0.65,
        gy: params.gy + 0.65,
        gz: gz + hz + 0.22,
        radius: 0.14,
        height: 0.24,
        topColor: "#fcd34d",
        sideLeftColor: "#78350f",
        sideRightColor: "#d97706",
        strokeColor: "#fef3c7",
      });
    }

    // Active workload rising data/heat particles
    if (params.activityStatus === "active" && camera.zoom >= 0.65) {
      const topCenter = bilerpQuad(box.topQuad, 0.5, 0.5);
      ctx.save();
      for (let i = 0; i < 3; i++) {
        const lift = ((params.timeSec * 0.9 + i * 0.33 + (params.seedOffset ?? 0)) % 1) * 20 * camera.zoom;
        const drift = Math.sin(params.timeSec * 2 + i * 2) * 4 * camera.zoom;
        ctx.fillStyle = colors.accent;
        ctx.globalAlpha = 0.72 * (1 - lift / (20 * camera.zoom));
        ctx.beginPath();
        ctx.arc(topCenter.x + drift, topCenter.y - 4 * camera.zoom - lift, 1.8 * camera.zoom, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  const topCenter = bilerpQuad(box.topQuad, 0.5, 0.5);
  const roofAnchor = {
    x: topCenter.x,
    y: topCenter.y - (params.spec.tier >= 2 ? 12 : 6) * camera.zoom,
  };

  if (colors.overlayLabel) {
    drawIsoBadge(ctx, roofAnchor, colors.overlayLabel, {
      border: colors.accent,
      textColor: colors.accent,
      fontSizePx: 9,
    });
  }

  return {
    hitPolygon: box.hitPolygon,
    roofAnchor,
    heightUnits: hz,
  };
}
