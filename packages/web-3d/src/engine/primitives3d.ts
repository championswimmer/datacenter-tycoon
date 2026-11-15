import {
  convexHull,
  DEFAULT_TILE_HEIGHT,
  DEFAULT_TILE_WIDTH,
  DEFAULT_UNIT_HEIGHT_PX,
  rotateGridCoord,
  type CameraTransform,
  type IsoPoint3D,
  type IsoRotation,
  type ScreenPoint,
} from "./isoMath.js";

export type CardinalFace = "N" | "S" | "E" | "W";

export interface IsoTileOptions {
  gx: number;
  gy: number;
  gz?: number;
  sx?: number;
  sy?: number;
  fill?: string | null;
  stroke?: string | null;
  lineWidth?: number;
  dashed?: boolean;
  alpha?: number;
  glowColor?: string;
  glowBlur?: number;
}

export interface IsoBoxOptions {
  gx: number;
  gy: number;
  gz: number;
  sx: number;
  sy: number;
  hz: number;
  topColor: string;
  leftColor: string;
  rightColor: string;
  strokeColor?: string;
  lineWidth?: number;
  alpha?: number;
  glowColor?: string;
  glowBlur?: number;
  topHighlight?: string;
}

export interface IsoBoxRenderResult {
  topQuad: [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint];
  frontLeftQuad: [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint];
  frontRightQuad: [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint];
  hitPolygon: ScreenPoint[];
  frontLeftCardinal: CardinalFace;
  frontRightCardinal: CardinalFace;
}

export interface IsoCylinderOptions {
  gx: number;
  gy: number;
  gz: number;
  radius: number;
  height: number;
  topColor: string;
  sideLeftColor: string;
  sideRightColor: string;
  strokeColor?: string;
  alpha?: number;
}

export interface IsoConduitOptions {
  color: string;
  widthPx?: number;
  glowColor?: string;
  glowBlur?: number;
  dashed?: boolean;
  dashPattern?: number[];
  dashOffset?: number;
  alpha?: number;
}

export interface IsoBadgeOptions {
  bg?: string;
  border?: string;
  textColor?: string;
  fontSizePx?: number;
}

function projectRotPoint(
  rx: number,
  ry: number,
  gz: number,
  cRotX: number,
  cRotY: number,
  camera: CameraTransform,
  viewportWidth: number,
  viewportHeight: number,
): ScreenPoint {
  const tw = (camera.tileWidth ?? DEFAULT_TILE_WIDTH) * camera.zoom;
  const th = (camera.tileHeight ?? DEFAULT_TILE_HEIGHT) * camera.zoom;
  const uh = (camera.unitHeightPx ?? DEFAULT_UNIT_HEIGHT_PX) * camera.zoom;
  const dx = rx - cRotX;
  const dy = ry - cRotY;

  return {
    x: viewportWidth * 0.5 + (dx - dy) * (tw * 0.5),
    y: viewportHeight * 0.5 + (dx + dy) * (th * 0.5) - gz * uh,
  };
}

/** Determine which canonical world cardinal directions face front-left (+ry) and front-right (+rx). */
export function visibleCardinalFaces(rotation: IsoRotation): {
  frontLeft: CardinalFace;
  frontRight: CardinalFace;
} {
  switch (rotation) {
    case 0:
      return { frontLeft: "S", frontRight: "E" };
    case 1:
      return { frontLeft: "E", frontRight: "N" };
    case 2:
      return { frontLeft: "N", frontRight: "W" };
    case 3:
      return { frontLeft: "W", frontRight: "S" };
  }
}

export function traceQuad(
  ctx: CanvasRenderingContext2D,
  quad: readonly ScreenPoint[],
): void {
  if (quad.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(quad[0]!.x, quad[0]!.y);
  for (let i = 1; i < quad.length; i++) {
    ctx.lineTo(quad[i]!.x, quad[i]!.y);
  }
  ctx.closePath();
}

/** Draw an isometric flat ground tile or horizontal cap quad. */
export function drawIsoTile(
  ctx: CanvasRenderingContext2D,
  camera: CameraTransform,
  viewportWidth: number,
  viewportHeight: number,
  opts: IsoTileOptions,
): ScreenPoint[] {
  const gz = opts.gz ?? 0;
  const sx = opts.sx ?? 1;
  const sy = opts.sy ?? 1;

  const p0 = rotateGridCoord(opts.gx, opts.gy, camera.gridCols, camera.gridRows, camera.rotation);
  const p1 = rotateGridCoord(opts.gx + sx, opts.gy, camera.gridCols, camera.gridRows, camera.rotation);
  const p2 = rotateGridCoord(opts.gx + sx, opts.gy + sy, camera.gridCols, camera.gridRows, camera.rotation);
  const p3 = rotateGridCoord(opts.gx, opts.gy + sy, camera.gridCols, camera.gridRows, camera.rotation);
  const cRot = rotateGridCoord(camera.centerX, camera.centerY, camera.gridCols, camera.gridRows, camera.rotation);

  const rxMin = Math.min(p0.rx, p1.rx, p2.rx, p3.rx);
  const rxMax = Math.max(p0.rx, p1.rx, p2.rx, p3.rx);
  const ryMin = Math.min(p0.ry, p1.ry, p2.ry, p3.ry);
  const ryMax = Math.max(p0.ry, p1.ry, p2.ry, p3.ry);

  const quad: ScreenPoint[] = [
    projectRotPoint(rxMin, ryMin, gz, cRot.rx, cRot.ry, camera, viewportWidth, viewportHeight),
    projectRotPoint(rxMax, ryMin, gz, cRot.rx, cRot.ry, camera, viewportWidth, viewportHeight),
    projectRotPoint(rxMax, ryMax, gz, cRot.rx, cRot.ry, camera, viewportWidth, viewportHeight),
    projectRotPoint(rxMin, ryMax, gz, cRot.rx, cRot.ry, camera, viewportWidth, viewportHeight),
  ];

  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  if (opts.glowColor) {
    ctx.shadowColor = opts.glowColor;
    ctx.shadowBlur = (opts.glowBlur ?? 10) * camera.zoom;
  }
  traceQuad(ctx, quad);
  if (opts.fill) {
    ctx.fillStyle = opts.fill;
    ctx.fill();
  }
  if (opts.stroke) {
    if (opts.dashed) {
      ctx.setLineDash([4 * camera.zoom, 3 * camera.zoom]);
    }
    ctx.strokeStyle = opts.stroke;
    ctx.lineWidth = (opts.lineWidth ?? 1) * Math.max(0.75, camera.zoom);
    ctx.stroke();
  }
  ctx.restore();
  return quad;
}

/**
 * Draw a shaded isometric 3D axis-aligned box with rotation-invariant lighting
 * and return projected quads + silhouette hit polygon.
 */
export function drawIsoBox(
  ctx: CanvasRenderingContext2D,
  camera: CameraTransform,
  viewportWidth: number,
  viewportHeight: number,
  opts: IsoBoxOptions,
): IsoBoxRenderResult {
  const r0 = rotateGridCoord(opts.gx, opts.gy, camera.gridCols, camera.gridRows, camera.rotation);
  const r1 = rotateGridCoord(opts.gx + opts.sx, opts.gy, camera.gridCols, camera.gridRows, camera.rotation);
  const r2 = rotateGridCoord(opts.gx + opts.sx, opts.gy + opts.sy, camera.gridCols, camera.gridRows, camera.rotation);
  const r3 = rotateGridCoord(opts.gx, opts.gy + opts.sy, camera.gridCols, camera.gridRows, camera.rotation);
  const cRot = rotateGridCoord(camera.centerX, camera.centerY, camera.gridCols, camera.gridRows, camera.rotation);

  const rxMin = Math.min(r0.rx, r1.rx, r2.rx, r3.rx);
  const rxMax = Math.max(r0.rx, r1.rx, r2.rx, r3.rx);
  const ryMin = Math.min(r0.ry, r1.ry, r2.ry, r3.ry);
  const ryMax = Math.max(r0.ry, r1.ry, r2.ry, r3.ry);

  const z0 = opts.gz;
  const z1 = opts.gz + opts.hz;

  const t00 = projectRotPoint(rxMin, ryMin, z1, cRot.rx, cRot.ry, camera, viewportWidth, viewportHeight);
  const t10 = projectRotPoint(rxMax, ryMin, z1, cRot.rx, cRot.ry, camera, viewportWidth, viewportHeight);
  const t11 = projectRotPoint(rxMax, ryMax, z1, cRot.rx, cRot.ry, camera, viewportWidth, viewportHeight);
  const t01 = projectRotPoint(rxMin, ryMax, z1, cRot.rx, cRot.ry, camera, viewportWidth, viewportHeight);

  const b10 = projectRotPoint(rxMax, ryMin, z0, cRot.rx, cRot.ry, camera, viewportWidth, viewportHeight);
  const b11 = projectRotPoint(rxMax, ryMax, z0, cRot.rx, cRot.ry, camera, viewportWidth, viewportHeight);
  const b01 = projectRotPoint(rxMin, ryMax, z0, cRot.rx, cRot.ry, camera, viewportWidth, viewportHeight);
  const b00 = projectRotPoint(rxMin, ryMin, z0, cRot.rx, cRot.ry, camera, viewportWidth, viewportHeight);

  const topQuad: [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint] = [t00, t10, t11, t01];
  const frontLeftQuad: [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint] = [t01, t11, b11, b01];
  const frontRightQuad: [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint] = [t11, t10, b10, b11];

  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  if (opts.glowColor) {
    ctx.shadowColor = opts.glowColor;
    ctx.shadowBlur = (opts.glowBlur ?? 12) * camera.zoom;
  }

  // Front-left face (+ry)
  traceQuad(ctx, frontLeftQuad);
  ctx.fillStyle = opts.leftColor;
  ctx.fill();

  // Front-right face (+rx)
  traceQuad(ctx, frontRightQuad);
  ctx.fillStyle = opts.rightColor;
  ctx.fill();

  // Top face (+gz)
  traceQuad(ctx, topQuad);
  ctx.fillStyle = opts.topColor;
  ctx.fill();

  ctx.shadowBlur = 0;
  if (opts.strokeColor) {
    ctx.strokeStyle = opts.strokeColor;
    ctx.lineWidth = (opts.lineWidth ?? 1) * Math.max(0.7, camera.zoom);
    ctx.lineJoin = "round";
    traceQuad(ctx, frontLeftQuad);
    ctx.stroke();
    traceQuad(ctx, frontRightQuad);
    ctx.stroke();
    traceQuad(ctx, topQuad);
    ctx.stroke();
  }

  if (opts.topHighlight) {
    ctx.strokeStyle = opts.topHighlight;
    ctx.lineWidth = Math.max(1, 1.4 * camera.zoom);
    ctx.beginPath();
    ctx.moveTo(t01.x, t01.y);
    ctx.lineTo(t11.x, t11.y);
    ctx.lineTo(t10.x, t10.y);
    ctx.stroke();
  }

  ctx.restore();

  const faces = visibleCardinalFaces(camera.rotation);
  return {
    topQuad,
    frontLeftQuad,
    frontRightQuad,
    hitPolygon: convexHull([t00, t10, t11, t01, b00, b10, b11, b01]),
    frontLeftCardinal: faces.frontLeft,
    frontRightCardinal: faces.frontRight,
  };
}

/** Interpolate (u, v) in [0, 1]^2 across an arbitrary projected screen quad [TL, TR, BR, BL]. */
export function bilerpQuad(
  quad: readonly [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint],
  u: number,
  v: number,
): ScreenPoint {
  const [tl, tr, br, bl] = quad;
  const topX = tl.x + (tr.x - tl.x) * u;
  const topY = tl.y + (tr.y - tl.y) * u;
  const botX = bl.x + (br.x - bl.x) * u;
  const botY = bl.y + (br.y - bl.y) * u;
  return {
    x: topX + (botX - topX) * v,
    y: topY + (botY - topY) * v,
  };
}

/** Draw an isometric sub-rectangle inside a face quad via bilinear perspective mapping. */
export function drawFaceRect(
  ctx: CanvasRenderingContext2D,
  quad: readonly [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint],
  u0: number,
  v0: number,
  u1: number,
  v1: number,
  fillStyle: string,
  strokeStyle?: string,
  lineWidth = 0.8,
): void {
  const p0 = bilerpQuad(quad, u0, v0);
  const p1 = bilerpQuad(quad, u1, v0);
  const p2 = bilerpQuad(quad, u1, v1);
  const p3 = bilerpQuad(quad, u0, v1);
  traceQuad(ctx, [p0, p1, p2, p3]);
  ctx.fillStyle = fillStyle;
  ctx.fill();
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

/** Draw a perspective-aligned grid of lit skyscraper windows or server blade LEDs on any vertical quad. */
export function drawIsoWindowGrid(
  ctx: CanvasRenderingContext2D,
  quad: readonly [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint],
  rows: number,
  cols: number,
  colorForCell: (row: number, col: number) => string | null,
  padU = 0.14,
  padV = 0.16,
): void {
  if (rows <= 0 || cols <= 0) return;
  const usableU = 1 - padU * 2;
  const usableV = 1 - padV * 2;
  const cellW = usableU / cols;
  const cellH = usableV / rows;
  const gapU = cellW * 0.24;
  const gapV = cellH * 0.28;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const fill = colorForCell(r, c);
      if (!fill) continue;
      const u0 = padU + c * cellW + gapU * 0.5;
      const u1 = padU + (c + 1) * cellW - gapU * 0.5;
      const v0 = padV + r * cellH + gapV * 0.5;
      const v1 = padV + (r + 1) * cellH - gapV * 0.5;
      drawFaceRect(ctx, quad, u0, v0, u1, v1, fill);
    }
  }
}

/** Draw an isometric vertical cylinder (cooling towers, water tanks, rotary hubs). */
export function drawIsoCylinder(
  ctx: CanvasRenderingContext2D,
  camera: CameraTransform,
  viewportWidth: number,
  viewportHeight: number,
  opts: IsoCylinderOptions,
): void {
  const cRot = rotateGridCoord(camera.centerX, camera.centerY, camera.gridCols, camera.gridRows, camera.rotation);
  const pRot = rotateGridCoord(opts.gx, opts.gy, camera.gridCols, camera.gridRows, camera.rotation);

  const rxPx = opts.radius * (camera.tileWidth ?? DEFAULT_TILE_WIDTH) * 0.5 * camera.zoom;
  const ryPx = opts.radius * (camera.tileHeight ?? DEFAULT_TILE_HEIGHT) * 0.5 * camera.zoom;

  const bot = projectRotPoint(pRot.rx, pRot.ry, opts.gz, cRot.rx, cRot.ry, camera, viewportWidth, viewportHeight);
  const top = projectRotPoint(
    pRot.rx,
    pRot.ry,
    opts.gz + opts.height,
    cRot.rx,
    cRot.ry,
    camera,
    viewportWidth,
    viewportHeight,
  );

  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;

  const grad = ctx.createLinearGradient(bot.x - rxPx, top.y, bot.x + rxPx, top.y);
  grad.addColorStop(0, opts.sideLeftColor);
  grad.addColorStop(0.55, opts.sideRightColor);
  grad.addColorStop(1, opts.sideLeftColor);

  ctx.beginPath();
  ctx.ellipse(bot.x, bot.y, Math.max(2, rxPx), Math.max(1, ryPx), 0, 0, Math.PI);
  ctx.lineTo(top.x - rxPx, top.y);
  ctx.ellipse(top.x, top.y, Math.max(2, rxPx), Math.max(1, ryPx), 0, Math.PI, Math.PI * 2);
  ctx.lineTo(bot.x + rxPx, bot.y);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  if (opts.strokeColor) {
    ctx.strokeStyle = opts.strokeColor;
    ctx.lineWidth = Math.max(0.8, camera.zoom);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.ellipse(top.x, top.y, Math.max(2, rxPx), Math.max(1, ryPx), 0, 0, Math.PI * 2);
  ctx.fillStyle = opts.topColor;
  ctx.fill();
  if (opts.strokeColor) {
    ctx.stroke();
  }

  ctx.restore();
}

/** Draw an isometric 3D polyline conduit (pipes, busbars, optical fiber trunks). */
export function drawIsoConduit(
  ctx: CanvasRenderingContext2D,
  camera: CameraTransform,
  viewportWidth: number,
  viewportHeight: number,
  points: readonly IsoPoint3D[],
  opts: IsoConduitOptions,
): ScreenPoint[] {
  if (points.length < 2) return [];
  const cRot = rotateGridCoord(camera.centerX, camera.centerY, camera.gridCols, camera.gridRows, camera.rotation);
  const screenPts = points.map((pt) => {
    const rot = rotateGridCoord(pt.gx, pt.gy, camera.gridCols, camera.gridRows, camera.rotation);
    return projectRotPoint(rot.rx, rot.ry, pt.gz, cRot.rx, cRot.ry, camera, viewportWidth, viewportHeight);
  });

  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  if (opts.glowColor) {
    ctx.shadowColor = opts.glowColor;
    ctx.shadowBlur = (opts.glowBlur ?? 8) * camera.zoom;
  }
  ctx.strokeStyle = opts.color;
  ctx.lineWidth = (opts.widthPx ?? 2.2) * Math.max(0.65, camera.zoom);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (opts.dashed) {
    const pattern = (opts.dashPattern ?? [8, 6]).map((v) => v * Math.max(0.7, camera.zoom));
    ctx.setLineDash(pattern);
    ctx.lineDashOffset = opts.dashOffset ?? 0;
  }
  ctx.beginPath();
  ctx.moveTo(screenPts[0]!.x, screenPts[0]!.y);
  for (let i = 1; i < screenPts.length; i++) {
    ctx.lineTo(screenPts[i]!.x, screenPts[i]!.y);
  }
  ctx.stroke();
  ctx.restore();
  return screenPts;
}

/** Draw a crisp floating HUD tag pill anchored at a 3D projected screen point. */
export function drawIsoBadge(
  ctx: CanvasRenderingContext2D,
  anchor: ScreenPoint,
  label: string,
  opts: IsoBadgeOptions = {},
): void {
  const fontSize = opts.fontSizePx ?? 10;
  ctx.save();
  ctx.font = `600 ${fontSize}px "JetBrains Mono", monospace`;
  const textWidth = ctx.measureText(label).width || label.length * fontSize * 0.6;
  const padX = 7;
  const boxW = textWidth + padX * 2;
  const boxH = fontSize + 8;
  const x = anchor.x - boxW * 0.5;
  const y = anchor.y - boxH;

  ctx.fillStyle = opts.bg ?? "rgba(7, 13, 22, 0.9)";
  ctx.strokeStyle = opts.border ?? "rgba(0, 245, 212, 0.65)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, boxW, boxH, 4);
  } else {
    ctx.rect(x, y, boxW, boxH);
  }
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = opts.textColor ?? "#e6f1ff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, anchor.x, y + boxH * 0.5 + 0.5);
  ctx.restore();
}

/** Utility: blend two hex colors (`t` in [0, 1]) for lighting & heatmaps. */
export function mixHex(hexA: string, hexB: string, tRaw: number): string {
  const t = Math.min(1, Math.max(0, tRaw));
  const parse = (hex: string): [number, number, number] => {
    const clean = hex.replace("#", "");
    const n = parseInt(clean.length === 3 ? clean.replace(/(.)/g, "$1$1") : clean, 16);
    if (Number.isNaN(n)) return [128, 128, 128];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [r1, g1, b1] = parse(hexA);
  const [r2, g2, b2] = parse(hexB);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
