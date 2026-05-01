import { useRef, useEffect } from "react";
import { useSelector } from "../../store/storeContext.js";
import { selectCash, selectTick } from "../../store/selectors.js";
import styles from "./CashSparkline.module.css";

const HISTORY_LEN = 60;
const W = 240;
const H = 64;

export function CashSparkline() {
  const cash  = useSelector(selectCash);
  const tick  = useSelector(selectTick);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const histRef   = useRef<number[]>([]);

  // Accumulate cash history (one entry per tick)
  const prev = histRef.current;
  if (prev.length === 0 || prev[prev.length - 1] !== cash) {
    histRef.current = [...prev, cash].slice(-HISTORY_LEN);
  }

  useEffect(() => {
    draw(canvasRef.current, histRef.current);
  }); // run after every render so it stays current

  return (
    <div className={styles.wrap}>
      <div className={styles.labelRow}>
        <span className={styles.label}>CASH TREND</span>
        <span className={styles.ticks}>{tick > 0 ? `last ${Math.min(tick, HISTORY_LEN)} ticks` : "no data yet"}</span>
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className={styles.canvas}
        aria-label="Cash over time sparkline"
        role="img"
      />
    </div>
  );
}

function draw(canvas: HTMLCanvasElement | null, data: number[]) {
  if (!canvas || data.length < 2) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio ?? 1;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width  = `${W}px`;
  canvas.style.height = `${H}px`;
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, W, H);

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const pad = 4;
  const innerW = W - pad * 2;
  const innerH = H - pad * 2;

  const xOf = (i: number) => pad + (i / (data.length - 1)) * innerW;
  const yOf = (v: number) => pad + (1 - (v - min) / range) * innerH;

  // Faint grid
  ctx.strokeStyle = "rgba(26, 34, 56, 0.8)";
  ctx.lineWidth   = 1;
  [0.25, 0.5, 0.75].forEach(t => {
    const y = pad + (1 - t) * innerH;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(W - pad, y);
    ctx.stroke();
  });

  // Gradient fill under line
  const grad = ctx.createLinearGradient(0, pad, 0, H - pad);
  grad.addColorStop(0,   "rgba(94, 240, 255, 0.18)");
  grad.addColorStop(1,   "rgba(94, 240, 255, 0)");

  ctx.beginPath();
  ctx.moveTo(xOf(0), yOf(data[0]!));
  data.forEach((v, i) => { if (i > 0) ctx.lineTo(xOf(i), yOf(v)); });
  ctx.lineTo(xOf(data.length - 1), H - pad);
  ctx.lineTo(xOf(0), H - pad);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Glow: draw line twice — blurry behind, sharp on top
  ctx.save();
  ctx.filter = "blur(3px)";
  ctx.strokeStyle = "rgba(94, 240, 255, 0.6)";
  ctx.lineWidth   = 3;
  ctx.beginPath();
  ctx.moveTo(xOf(0), yOf(data[0]!));
  data.forEach((v, i) => { if (i > 0) ctx.lineTo(xOf(i), yOf(v)); });
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = "#5ef0ff";
  ctx.lineWidth   = 1.5;
  ctx.lineJoin    = "round";
  ctx.beginPath();
  ctx.moveTo(xOf(0), yOf(data[0]!));
  data.forEach((v, i) => { if (i > 0) ctx.lineTo(xOf(i), yOf(v)); });
  ctx.stroke();

  // Endpoint dot
  const lx = xOf(data.length - 1);
  const ly = yOf(data[data.length - 1]!);
  ctx.beginPath();
  ctx.arc(lx, ly, 3, 0, Math.PI * 2);
  ctx.fillStyle = "#5ef0ff";
  ctx.fill();
}
