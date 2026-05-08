import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useSelector, useGameDispatch } from "../../store/storeContext.js";
import {
  selectCash,
  selectPlayerName,
  selectTick,
  selectMonthlyPnl,
  selectActiveContracts,
  selectMarket,
  selectAudioSettings,
  selectReliabilitySummary,
  selectReliabilityMarketEffectSummary,
} from "../../store/selectors.js";
import { LedSegment } from "../../theme/primitives/index.js";
import { navigate } from "../../router/hashRouter.js";
import type { Speed } from "../../store/tickDriver.js";
import { isDesktopRuntime } from "../../platform/desktop.js";
import { ResetGameModal } from "./ResetGameModal.js";
import { AudioSettingsModal } from "../settings/AudioSettingsModal.js";
import { tickToGameDate, formatGameDate } from "../../store/gameTime.js";
import { useTickFraction } from "../../store/tickFractionStore.js";
import styles from "./TopBar.module.css";

function formatMoney(n: number, showSign = false): string {
  const sign = showSign ? (n >= 0 ? "+" : "") : "";
  const abs  = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}$${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${sign}$${(n / 1_000).toFixed(1)}K`;
  return `${sign}$${n.toLocaleString()}`;
}

interface TopBarProps {
  speed: Speed;
  onSpeedChange: Dispatch<SetStateAction<Speed>>;
  onOpenTutorial?: () => void;
}

const SPEED_LABELS: Record<Speed, string> = { 0: "⏸", 1: "▶", 2: "▶▶", 3: "▶▶▶" };

export function TopBar({ speed, onSpeedChange, onOpenTutorial }: TopBarProps) {
  const fraction        = useTickFraction();
  const dispatch        = useGameDispatch();
  const playerName      = useSelector(selectPlayerName);
  const cash            = useSelector(selectCash);
  const tick            = useSelector(selectTick);
  const pnl             = useSelector(selectMonthlyPnl);
  const activeContracts = useSelector(selectActiveContracts);
  const market          = useSelector(selectMarket);
  const audioSettings   = useSelector(selectAudioSettings);
  const reliability     = useSelector(selectReliabilitySummary);
  const reliabilityFx   = useSelector(selectReliabilityMarketEffectSummary);

  const gameDate = tickToGameDate(tick, fraction);

  const isDesktop = isDesktopRuntime();
  const breachedCount = activeContracts.filter(c => c.status === "breached").length;
  const expiringOffers = market.filter(c => c.expiresAtTick - tick <= 1).length;
  const contractsEndingSoon = activeContracts.filter(
    c => c.startedAtTick !== undefined && c.startedAtTick + c.termMonths - tick <= 1,
  ).length;
  const cashLow = cash < 100_000;

  const [showResetModal, setShowResetModal] = useState(false);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const openContracts = () => navigate({ view: "contracts" });
  const reliabilityBandLabel = reliability.band.toUpperCase();
  const reliabilityTrendLabel = reliability.lastDelta > 0
    ? `▲ +${reliability.lastDelta}`
    : reliability.lastDelta < 0
      ? `▼ ${reliability.lastDelta}`
      : "— steady";

  const banner = breachedCount > 0
    ? { tone: "danger", label: `⚠ ${breachedCount} contract breach${breachedCount > 1 ? "es" : ""}` }
    : contractsEndingSoon > 0
      ? { tone: "warn", label: `${contractsEndingSoon} contract${contractsEndingSoon > 1 ? "s" : ""} ending soon — expiring within 1 month` }
      : expiringOffers > 0
        ? { tone: "info", label: `${expiringOffers} market offer${expiringOffers > 1 ? "s" : ""} expiring within 1 month` }
        : null;

  return (
    <header className={styles.bar}>
      {/* ── Left: branding + company ── */}
      <div className={styles.left}>
        <span className={styles.logo}>DCT</span>
        <span className={styles.company}>{playerName}</span>
        {isDesktop && <span className={styles.desktopBadge}>DESKTOP</span>}
      </div>

      {/* ── Center: financials + date ── */}
      <div className={styles.center}>
        <div className={styles.hudBlock}>
          <span className={styles.hudLabel}>CASH</span>
          <span className={[styles.hudValue, cashLow ? styles.cashLow : styles.cashOk].join(" ")}>
            {formatMoney(cash)}
          </span>
        </div>

        <div className={styles.divider} />

        <div className={styles.hudBlock}>
          <span className={styles.hudLabel}>REV/mo</span>
          <span className={[styles.hudValue, styles.revenue].join(" ")}>
            {formatMoney(pnl.revenue, true)}
          </span>
        </div>

        <div className={styles.hudBlock}>
          <span className={styles.hudLabel}>OPEX/mo</span>
          <span className={[styles.hudValue, styles.opex].join(" ")}>
            -{formatMoney(pnl.opex)}
          </span>
        </div>

        <div className={styles.hudBlock}>
          <span className={styles.hudLabel}>NET/mo</span>
          <span className={[
            styles.hudValue,
            pnl.net >= 0 ? styles.netPositive : styles.netNegative,
          ].join(" ")}>
            {formatMoney(pnl.net, true)}
          </span>
        </div>

        <div className={styles.divider} />

        <div className={styles.hudBlock} title={reliabilityFx.summary}>
          <span className={styles.hudLabel}>RELIABILITY</span>
          <span className={[
            styles.hudValue,
            (reliability.band === "platinum" || reliability.band === "diamond")
              ? styles.reliabilityTrusted
              : (reliability.band === "silver" || reliability.band === "bronze")
                ? styles.reliabilityAtRisk
                : styles.reliabilityBaseline,
          ].join(" ")}>{reliability.score} · {reliabilityBandLabel}</span>
          <span className={styles.hudMeta}>{reliabilityTrendLabel} · {reliabilityFx.offerCount} offers</span>
        </div>

        <div className={styles.divider} />

        <div className={styles.hudBlock}>
          <span className={styles.hudLabel}>DATE</span>
          <span className={styles.hudValue}>{formatGameDate(gameDate)}</span>
        </div>
      </div>

      {/* ── Right: alerts + help + speed ── */}
      <div className={styles.right}>
        {banner && (
          <button
            className={[
              styles.alertBadge,
              banner.tone === "danger" ? styles.alertDanger : banner.tone === "warn" ? styles.alertWarn : styles.alertInfo,
            ].join(" ")}
            title="Open contracts"
            onClick={openContracts}
          >
            {banner.label}
          </button>
        )}

        <button
          className={styles.helpBtn}
          onClick={() => setShowAudioModal(true)}
          title="Audio Settings"
          aria-label="Audio Settings"
        >
          {audioSettings.master ? "🔊" : "🔇"}
        </button>

        <button
          className={styles.helpBtn}
          onClick={() => setShowResetModal(true)}
          title="Reset Game"
          aria-label="Reset Game"
        >
          ⟲
        </button>

        {onOpenTutorial && (
          <button
            className={styles.helpBtn}
            onClick={onOpenTutorial}
            title="How to Play"
            aria-label="How to Play"
          >
            ?
          </button>
        )}

        <LedSegment
          color={speed === 0 ? "amber" : "lime"}
          blink={speed > 0}
          size={8}
        />

        <div className={styles.speeds}>
          {([0, 1, 2, 3] as Speed[]).map(s => (
            <button
              key={s}
              className={[styles.speedBtn, speed === s ? styles.speedActive : ""].join(" ")}
              onClick={() => onSpeedChange(s)}
              title={s === 0 ? "Pause" : `${s}× speed`}
              aria-pressed={speed === s}
            >
              {SPEED_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {showResetModal && (
        <ResetGameModal onClose={() => setShowResetModal(false)} />
      )}

      {showAudioModal && (
        <AudioSettingsModal onClose={() => setShowAudioModal(false)} />
      )}
    </header>
  );
}
