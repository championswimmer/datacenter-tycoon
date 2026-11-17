import type { Dispatch, SetStateAction } from "react";
import type { DatacenterId, RegionId } from "@datacenter-tycoon/game-logic";
import {
  formatGameDate,
  selectAllDatacenters,
  selectAudioSettings,
  selectCash,
  selectDifficulty,
  selectMonthlyPnl,
  selectPlayerName,
  selectRegions,
  selectReliabilitySummary,
  selectSubtick,
  selectTick,
  tickToGameDate,
  useSelector,
  useTickFraction,
  type Speed,
} from "@datacenter-tycoon/web";
import type { CameraViewMode } from "../../state/viewportState.js";
import styles from "./TopHudBar.module.css";

function formatMoney(n: number, showSign = false): string {
  const sign = showSign ? (n >= 0 ? "+" : "") : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}$${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(n / 1_000).toFixed(1)}K`;
  return `${sign}$${n.toLocaleString()}`;
}

export interface TopHudBarProps {
  viewMode: CameraViewMode;
  activeRegionId: RegionId | null;
  activeDcId: DatacenterId | null;
  speed: Speed;
  onSpeedChange: Dispatch<SetStateAction<Speed>>;
  onEnterCity: () => void;
  onSelectRegion: (regionId: RegionId) => void;
  onEnterFacility: (dcId: DatacenterId) => void;
  onOpenTutorial: () => void;
  onOpenAudioSettings: () => void;
  onOpenResetModal: () => void;
}

const SPEED_OPTIONS: { value: Speed; label: string; ariaLabel?: string; title: string }[] = [
  { value: 0, label: "⏸", ariaLabel: "Pause simulation", title: "Pause simulation (Space)" },
  { value: 1, label: "1x", title: "Normal speed" },
  { value: 2, label: "2x", title: "Fast speed" },
  { value: 3, label: "3x", title: "Ultra speed" },
];

export function TopHudBar({
  viewMode,
  activeRegionId,
  activeDcId,
  speed,
  onSpeedChange,
  onEnterCity,
  onSelectRegion,
  onEnterFacility,
  onOpenTutorial,
  onOpenAudioSettings,
  onOpenResetModal,
}: TopHudBarProps) {
  const fraction = useTickFraction();
  const playerName = useSelector(selectPlayerName);
  const difficulty = useSelector(selectDifficulty);
  const cash = useSelector(selectCash);
  const tick = useSelector(selectTick);
  const subtick = useSelector(selectSubtick);
  const pnl = useSelector(selectMonthlyPnl);
  const reliability = useSelector(selectReliabilitySummary);
  const audioSettings = useSelector(selectAudioSettings);
  const regions = useSelector(selectRegions);
  const datacenters = useSelector(selectAllDatacenters);

  const gameDate = tickToGameDate(tick, subtick, fraction);
  const cashLow = cash < 100_000;
  const activeRegion = regions.find((r) => r.id === activeRegionId) ?? regions[0] ?? null;
  const regionDcs = activeRegion
    ? datacenters.filter((dc) => dc.regionId === activeRegion.id)
    : datacenters;

  return (
    <header className={styles.wrapper} aria-label="3D Top Telemetry">
      <div className={styles.bar}>
        {/* Left: View Switcher & Breadcrumb */}
        <div className={styles.brandSection}>
          <span className={styles.logo}>DCT·3D</span>
          <div className={styles.modeSwitch} role="group" aria-label="3D View Mode">
            <button
              type="button"
              className={[styles.modeBtn, viewMode === "city" ? styles.modeBtnActive : ""].filter(Boolean).join(" ")}
              onClick={onEnterCity}
            >
              🏙 Region View
            </button>
            {datacenters.length > 0 && (
              <button
                type="button"
                className={[styles.modeBtn, viewMode === "facility" ? styles.modeBtnActive : ""].filter(Boolean).join(" ")}
                onClick={() => {
                  const target = activeDcId ?? regionDcs[0]?.id ?? datacenters[0]?.id;
                  if (target) onEnterFacility(target);
                }}
              >
                🖥 Facility 3D
              </button>
            )}
          </div>

          {regions.length > 0 && (
            <select
              aria-label="Active Region"
              className={styles.select}
              value={activeRegion?.id ?? ""}
              onChange={(e) => onSelectRegion(e.target.value as RegionId)}
            >
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} · {r.city}
                </option>
              ))}
            </select>
          )}

          {datacenters.length > 0 && (
            <select
              aria-label="Active Datacenter"
              className={styles.select}
              value={activeDcId ?? ""}
              onChange={(e) => {
                if (e.target.value) {
                  onEnterFacility(e.target.value as DatacenterId);
                }
              }}
            >
              <option value="" disabled>
                Jump to facility…
              </option>
              {datacenters.map((dc) => (
                <option key={dc.id} value={dc.id}>
                  {dc.name} ({dc.placements.length}/{dc.spec.rows * dc.spec.positionsPerRow})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Center: Economy & Simulation Clock */}
        <div className={styles.telemetrySection}>
          <div className={styles.companyChip}>
            <span className={styles.companyName}>{playerName}</span>
            <span className={styles.diffBadge}>{difficulty.toUpperCase()}</span>
          </div>

          <div className={styles.metric}>
            <span className={styles.metricLabel}>CASH</span>
            <span className={[styles.metricValue, cashLow ? styles.danger : styles.cyan].join(" ")}>
              {formatMoney(cash)}
            </span>
          </div>

          <div className={styles.metric}>
            <span className={styles.metricLabel}>NET/MO</span>
            <span className={[styles.metricValue, pnl.net >= 0 ? styles.lime : styles.danger].join(" ")}>
              {formatMoney(pnl.net, true)}
            </span>
          </div>

          <div className={styles.metric}>
            <span className={styles.metricLabel}>SLA</span>
            <span className={styles.metricValue}>
              {reliability.score} · {reliability.band.toUpperCase()}
            </span>
          </div>

          <div className={styles.metric}>
            <span className={styles.metricLabel}>DATE</span>
            <span className={styles.metricValue}>{formatGameDate(gameDate)}</span>
          </div>
        </div>

        {/* Right: Speed & Utility Controls */}
        <div className={styles.controlsSection}>
          <div className={styles.speedGroup} role="group" aria-label="Simulation Speed">
            {SPEED_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                title={opt.title}
                aria-label={opt.ariaLabel}
                aria-pressed={speed === opt.value}
                className={[styles.speedBtn, speed === opt.value ? styles.speedBtnActive : ""].filter(Boolean).join(" ")}
                onClick={() => onSpeedChange(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className={styles.iconBtn}
            onClick={onOpenAudioSettings}
            title="Audio Settings"
            aria-label="Audio Settings"
          >
            {audioSettings.master ? "🔊" : "🔇"}
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onOpenTutorial}
            title="Tutorial"
            aria-label="Open Tutorial"
          >
            ?
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onOpenResetModal}
            title="Reset Game"
            aria-label="Reset Game"
          >
            ↺
          </button>
        </div>
      </div>
    </header>
  );
}
