import { Panel } from "../../theme/primitives/Panel.js";
import { StatTile } from "../../theme/primitives/StatTile.js";
import { NeonButton } from "../../theme/primitives/NeonButton.js";
import { LedSegment } from "../../theme/primitives/LedSegment.js";
import { ProgressBar } from "../../theme/primitives/ProgressBar.js";
import styles from "./ThemePlayground.module.css";

export default function ThemePlayground() {
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <h1>Theme Playground</h1>
        <span className={styles.note}>dev only — route #/__theme</span>
      </header>

      {/* ── Panels ──────────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h3>Panel</h3>
        <div className={styles.row}>
          {(["cyan", "amber", "lime", "magenta", "red", "none"] as const).map(
            (accent) => (
              <Panel key={accent} accent={accent} style={{ minWidth: 120 }}>
                <span className={styles.swatch}>accent: {accent}</span>
              </Panel>
            ),
          )}
        </div>
        <div className={styles.row}>
          {(["default", "raised", "ghost"] as const).map((variant) => (
            <Panel key={variant} variant={variant} accent="none" style={{ minWidth: 120 }}>
              <span className={styles.swatch}>variant: {variant}</span>
            </Panel>
          ))}
        </div>
      </section>

      {/* ── StatTiles ───────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h3>StatTile</h3>
        <div className={styles.row}>
          <StatTile label="CASH" value="$2,500,000" color="lime" sub="starting balance" />
          <StatTile label="vCPU" value={1024} color="cyan" sub="cores" />
          <StatTile label="RAM" value="512 GB" color="default" />
          <StatTile label="OPEX/mo" value="$18,400" color="amber" sub="monthly" />
          <StatTile label="PENALTY" value="-$5,000" color="red" />
        </div>
      </section>

      {/* ── NeonButton ──────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h3>NeonButton</h3>
        <div className={styles.row}>
          <NeonButton variant="primary">Primary</NeonButton>
          <NeonButton variant="secondary">Secondary</NeonButton>
          <NeonButton variant="ghost">Ghost</NeonButton>
          <NeonButton variant="danger">Danger</NeonButton>
          <NeonButton disabled>Disabled</NeonButton>
        </div>
        <div className={styles.row}>
          {(["sm", "md", "lg"] as const).map((size) => (
            <NeonButton key={size} size={size}>
              size {size}
            </NeonButton>
          ))}
        </div>
      </section>

      {/* ── LedSegment ──────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h3>LedSegment</h3>
        <div className={styles.row}>
          <LedSegment color="cyan" label="Power" />
          <LedSegment color="lime" label="Activity" blink />
          <LedSegment color="red" label="Fault" />
          <LedSegment color="amber" label="Warning" blink />
          <LedSegment color="magenta" label="GPU" />
          <LedSegment color="off" label="Offline" />
        </div>
        <div className={styles.row}>
          {([8, 12, 16] as const).map((size) => (
            <LedSegment key={size} color="cyan" size={size} label={`${size}px`} />
          ))}
        </div>
      </section>

      {/* ── ProgressBar ─────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h3>ProgressBar</h3>
        <div className={styles.col}>
          {[10, 50, 75, 90, 100].map((v) => (
            <div key={v} className={styles.barRow}>
              <span className={styles.barLabel}>{v}%</span>
              <ProgressBar value={v} max={100} color="auto" showLabel />
            </div>
          ))}
          <div className={styles.barRow}>
            <span className={styles.barLabel}>fixed lime</span>
            <ProgressBar value={65} max={100} color="lime" showLabel />
          </div>
        </div>
      </section>

      {/* ── Color palette ───────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h3>Color Tokens</h3>
        <div className={styles.row}>
          {[
            ["--neon-cyan", "Cyan"],
            ["--neon-amber", "Amber"],
            ["--neon-lime", "Lime"],
            ["--neon-magenta", "Magenta"],
            ["--neon-red", "Red"],
            ["--neon-purple", "Purple"],
            ["--neon-blue", "Blue"],
          ].map(([token, name]) => (
            <div key={token} className={styles.colorSwatch}>
              <div
                className={styles.colorBlock}
                style={{ background: `var(${token})` }}
              />
              <span className={styles.colorName}>{name}</span>
              <span className={styles.colorToken}>{token}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
