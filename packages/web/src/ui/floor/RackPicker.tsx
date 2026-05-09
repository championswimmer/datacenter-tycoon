import { useState, useEffect, useCallback, useRef } from "react";
import {
  RACK_CATALOG,
  canPlaceRack,
} from "@datacenter-tycoon/game-logic";
import type {
  Datacenter,
  RackSpec,
  RackKind,
  PlacementFailureReason,
} from "@datacenter-tycoon/game-logic";
import { useSelector, useGameDispatch } from "../../store/storeContext.js";
import { selectCash, selectAudioEnabled } from "../../store/selectors.js";
import { nextRackPlacementId } from "../../store/ids.js";
import { InsufficientFunds } from "../onboarding/InsufficientFunds.js";
import { playSound } from "../../audio/AudioEngine.js";
import { useDialogFocus } from "../dialogFocus.js";
import styles from "./RackPicker.module.css";

export interface RackPickerProps {
  datacenter: Datacenter;
  row: number;
  position: number;
  onClose: () => void;
}

// ── Catalog helpers ────────────────────────────────────────────────────────────

type KindFilter = "all" | RackKind;

const KIND_FILTERS: { id: KindFilter; label: string }[] = [
  { id: "all", label: "ALL" },
  { id: "compute", label: "COMPUTE" },
  { id: "memory", label: "MEMORY" },
  { id: "storage", label: "STORAGE" },
  { id: "gpu", label: "GPU" },
];

const ALL_SPECS: RackSpec[] = Object.values(RACK_CATALOG).sort((a, b) => {
  const kindOrder: Record<RackKind, number> = { compute: 0, memory: 1, storage: 2, gpu: 3 };
  if (a.kind !== b.kind) return kindOrder[a.kind] - kindOrder[b.kind];
  return a.tier - b.tier;
});

const FAILURE_MESSAGES: Record<PlacementFailureReason, string> = {
  slot_taken: "Slot is already occupied",
  out_of_bounds: "Outside grid bounds",
  insufficient_power: "DC power cap exceeded",
  insufficient_cooling: "DC cooling cap exceeded",
  insufficient_bandwidth: "DC bandwidth cap exceeded",
  cooling_type_mismatch: "Tier 3 requires liquid cooling",
};

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

function rowLabel(row: number): string {
  return String.fromCharCode(65 + row); // A, B, C...
}

// ── Component ──────────────────────────────────────────────────────────────────

export function RackPicker({ datacenter, row, position, onClose }: RackPickerProps) {
  const cash = useSelector(selectCash);
  const audioEnabled = useSelector(selectAudioEnabled);
  const dispatch = useGameDispatch();

  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useDialogFocus(closeButtonRef);

  const visibleSpecs = kindFilter === "all"
    ? ALL_SPECS
    : ALL_SPECS.filter((s) => s.kind === kindFilter);

  const handleInstall = useCallback((spec: RackSpec) => {
    const placeResult = canPlaceRack(datacenter, spec, { row, position });
    const affordable = cash >= spec.capexCost;
    if (!placeResult.ok || !affordable) return;

    dispatch({
      type: "PlaceRack",
      dcId: datacenter.id,
      specId: spec.id,
      row,
      position,
      placementId: nextRackPlacementId(),
    });
    playSound("click", !audioEnabled);
    onClose();
  }, [audioEnabled, cash, datacenter, dispatch, onClose, position, row]);

  // ESC closes
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="rp-title">
        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h2 id="rp-title" className={styles.title}>INSTALL RACK</h2>
            <span className={styles.slotId}>
              Row {rowLabel(row)}, Slot {position + 1}
            </span>
          </div>
          <button ref={closeButtonRef} className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* ── Kind filter chips ── */}
        <div className={styles.filterRow} role="group" aria-label="Filter by kind">
          {KIND_FILTERS.map((kf) => (
            <button
              key={kf.id}
              className={[styles.chip, kindFilter === kf.id ? styles.chipActive : ""].join(" ")}
              onClick={() => setKindFilter(kf.id)}
              aria-pressed={kindFilter === kf.id}
            >
              {kf.label}
            </button>
          ))}
        </div>

        {/* ── Spec cards ── */}
        <div className={styles.cards}>
          {visibleSpecs.map((spec) => {
            const placeResult = canPlaceRack(datacenter, spec, { row, position });
            const affordable = cash >= spec.capexCost;
            const disabled = !placeResult.ok || !affordable;
            return (
              <RackCard
                key={spec.id}
                spec={spec}
                cash={cash}
                placeOk={placeResult.ok}
                failReason={placeResult.ok ? undefined : placeResult.reason}
                affordable={affordable}
                disabled={disabled}
                onInstall={() => handleInstall(spec)}
              />
            );
          })}
        </div>

        {/* ── Footer ── */}
        <div className={styles.footer}>
          <span className={styles.footerHint}>
            Click any available rack card to place it immediately. Disabled cards explain why they cannot be installed.
          </span>
          <div className={styles.footerBtns}>
            <button className={styles.cancelBtn} onClick={onClose}>CANCEL</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Rack Card ──────────────────────────────────────────────────────────────────

interface RackCardProps {
  spec: RackSpec;
  cash: number;
  placeOk: boolean;
  failReason?: PlacementFailureReason;
  affordable: boolean;
  disabled: boolean;
  onInstall: () => void;
}

const KIND_ICON: Record<RackKind, string> = {
  compute: "⚡",
  memory: "🧠",
  storage: "💾",
  gpu: "🎮",
};

function RackCard({ spec, cash, placeOk, failReason, affordable, disabled, onInstall }: RackCardProps) {
  const primaryCapacity = getPrimaryCapacity(spec);
  return (
    <button
      type="button"
      className={[
        styles.card,
        styles[`kind-${spec.kind}`],
        disabled ? styles.cardDisabled : "",
      ].filter(Boolean).join(" ")}
      onClick={onInstall}
      disabled={disabled}
      title={disabled && failReason ? FAILURE_MESSAGES[failReason] : undefined}
    >
      {/* Header */}
      <div className={styles.cardHead}>
        <span className={styles.cardIcon}>{KIND_ICON[spec.kind]}</span>
        <div>
          <div className={styles.cardName}>{spec.name}</div>
          <div className={styles.tierPips}>
            {Array.from({ length: spec.tier }, (_, i) => (
              <span key={i} className={styles.pip} />
            ))}
          </div>
        </div>
      </div>

      {/* Primary capacity */}
      <div className={styles.primaryCap}>
        <span className={styles.primaryVal}>{primaryCapacity.value}</span>
        <span className={styles.primaryUnit}>{primaryCapacity.unit}</span>
      </div>

      {/* Secondary specs */}
      <dl className={styles.secSpecs}>
        <dt>PWR</dt><dd>{spec.powerDrawKw} kW</dd>
        <dt>MAINT</dt><dd>{formatMoney(spec.monthlyMaintenance)}/mo</dd>
      </dl>

      {/* Footer: price + status */}
      <div className={styles.cardFoot}>
        <span className={[styles.price, affordable ? styles.priceOk : styles.priceNo].join(" ")}>
          {formatMoney(spec.capexCost)}
        </span>
        {!affordable && <InsufficientFunds shortfall={spec.capexCost - cash} />}
        {!placeOk && affordable && failReason && (
          <span className={styles.failBadge}>{FAILURE_MESSAGES[failReason]}</span>
        )}
        {!disabled && <span className={styles.okBadge}>Click to install</span>}
      </div>
    </button>
  );
}

function getPrimaryCapacity(spec: RackSpec): { value: string; unit: string } {
  switch (spec.kind) {
    case "compute": return { value: spec.vCpu.toLocaleString(), unit: "vCPU" };
    case "memory": return { value: spec.ramGb.toLocaleString(), unit: "GB RAM" };
    case "storage": return { value: spec.storageTb.toString(), unit: "TB SSD" };
    case "gpu": return { value: spec.gpuFlops.toLocaleString(), unit: "TFLOPS" };
  }
}
