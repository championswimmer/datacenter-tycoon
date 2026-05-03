import { useState, useEffect, useCallback } from "react";
import { DATACENTER_CATALOG, DEFAULT_REGION_ID } from "@datacenter-tycoon/game-logic";
import type { DatacenterSpec } from "@datacenter-tycoon/game-logic";
import { useSelector, useGameDispatch } from "../../store/storeContext.js";
import { selectCash } from "../../store/selectors.js";
import { nextDcId } from "../../store/ids.js";
import { navigateToDc } from "../../router/hashRouter.js";
import { InsufficientFunds } from "./InsufficientFunds.js";
import styles from "./NewDatacenterModal.module.css";

interface NewDatacenterModalProps {
  onClose: () => void;
}

// ── Catalog helpers ────────────────────────────────────────────────────────────

/** Sorted cheapest → most expensive so cards read naturally. */
const CATALOG_ENTRIES: DatacenterSpec[] = Object.values(DATACENTER_CATALOG).sort(
  (a, b) => a.capexCost - b.capexCost,
);

function tierLabel(spec: DatacenterSpec): string {
  if (spec.capexCost < 500_000)   return "STARTER";
  if (spec.capexCost < 5_000_000) return "PROFESSIONAL";
  return "ENTERPRISE";
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

function formatBtu(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M BTU/hr`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K BTU/hr`;
  return `${n} BTU/hr`;
}

// ── Modal ──────────────────────────────────────────────────────────────────────

export function NewDatacenterModal({ onClose }: NewDatacenterModalProps) {
  const cash     = useSelector(selectCash);
  const dispatch = useGameDispatch();

  // Default to first affordable spec, else first spec.
  const defaultSpec =
    CATALOG_ENTRIES.find(s => cash >= s.capexCost) ?? CATALOG_ENTRIES[0]!;
  const [selectedId, setSelectedId] = useState<string>(defaultSpec.id);

  const selectedSpec = CATALOG_ENTRIES.find(s => s.id === selectedId)!;
  const canAfford    = cash >= selectedSpec.capexCost;

  // ESC closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleBuild = useCallback(() => {
    if (!canAfford) return;
    const dcId = nextDcId();
    dispatch({ type: "BuildDatacenter", specId: selectedSpec.id, dcId, regionId: DEFAULT_REGION_ID });
    navigateToDc(dcId);
    onClose();
  }, [canAfford, dispatch, selectedSpec.id, onClose]);

  return (
    /* Backdrop */
    <div
      className={styles.backdrop}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      {/* Panel */}
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-dc-title"
      >
        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h2 id="new-dc-title" className={styles.title}>BUILD DATACENTER</h2>
            <span className={styles.budget}>
              Budget: <strong className={styles.budgetAmt}>{formatMoney(cash)}</strong>
            </span>
          </div>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close modal"
          >✕</button>
        </div>

        {/* ── Catalog cards ── */}
        <div className={styles.catalog}>
          {CATALOG_ENTRIES.map(spec => (
            <DcCard
              key={spec.id}
              spec={spec}
              cash={cash}
              selected={spec.id === selectedId}
              onSelect={() => setSelectedId(spec.id)}
            />
          ))}
        </div>

        {/* ── Footer ── */}
        <div className={styles.footer}>
          {!canAfford && (
            <InsufficientFunds
              shortfall={selectedSpec.capexCost - cash}
              size="md"
            />
          )}
          <div className={styles.footerBtns}>
            <button className={styles.cancelBtn} onClick={onClose}>
              CANCEL
            </button>
            <button
              className={styles.buildBtn}
              onClick={handleBuild}
              disabled={!canAfford}
              title={!canAfford ? `Need ${formatMoney(selectedSpec.capexCost - cash)} more` : undefined}
            >
              BUILD — {formatMoney(selectedSpec.capexCost)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DC Card ────────────────────────────────────────────────────────────────────

interface DcCardProps {
  spec:     DatacenterSpec;
  cash:     number;
  selected: boolean;
  onSelect: () => void;
}

const DC_ICONS: Record<string, string> = {
  garage:     "🏠",
  warehouse:  "🏭",
  hyperscale: "🌐",
};

function DcCard({ spec, cash, selected, onSelect }: DcCardProps) {
  const affordable = cash >= spec.capexCost;
  const shortfall  = spec.capexCost - cash;
  const totalSlots = spec.rows * spec.positionsPerRow;

  return (
    <button
      className={[
        styles.card,
        selected    ? styles.cardSelected    : "",
        !affordable ? styles.cardUnaffordable : "",
      ].filter(Boolean).join(" ")}
      onClick={onSelect}
      aria-pressed={selected}
      aria-disabled={!affordable}
    >
      {/* ── Card header ── */}
      <div className={styles.cardHeader}>
        <span className={styles.cardIcon}>{DC_ICONS[spec.id] ?? "🖥"}</span>
        <div className={styles.cardTitles}>
          <span className={styles.cardName}>{spec.name}</span>
          <span className={[
            styles.tierBadge,
            styles[`tier-${tierLabel(spec).toLowerCase()}`],
          ].join(" ")}>
            {tierLabel(spec)}
          </span>
        </div>
      </div>

      {/* ── Spec grid ── */}
      <dl className={styles.specs}>
        <SpecRow label="GRID"      value={`${spec.rows} × ${spec.positionsPerRow}  (${totalSlots} slots)`} />
        <SpecRow label="POWER"     value={`${spec.powerCapacityKw.toLocaleString()} kW`} />
        <SpecRow label="COOLING"   value={formatBtu(spec.coolingCapacityBtuPerHr)}
                                   badge={spec.coolingType.toUpperCase()} badgeKind={spec.coolingType} />
        <SpecRow label="BANDWIDTH" value={`${spec.bandwidthGbps.toLocaleString()} Gbps`} />
        <SpecRow label="STAFF"     value={`${spec.staffCount.toLocaleString()} employees`} dim />
      </dl>

      {/* ── Price + affordability ── */}
      <div className={styles.cardFooter}>
        <span className={[styles.capex, affordable ? styles.capexOk : styles.capexNo].join(" ")}>
          {formatMoney(spec.capexCost)}
        </span>
        {!affordable && <InsufficientFunds shortfall={shortfall} />}
        {affordable  && <span className={styles.affordBadge}>✓ AFFORDABLE</span>}
      </div>
    </button>
  );
}

function SpecRow({
  label, value, dim, badge, badgeKind,
}: {
  label: string;
  value: string;
  dim?: boolean;
  badge?: string;
  badgeKind?: string;
}) {
  return (
    <>
      <dt className={styles.specKey}>{label}</dt>
      <dd className={[styles.specVal, dim ? styles.specDim : ""].join(" ")}>
        {value}
        {badge && (
          <span className={[styles.specBadge, badgeKind ? styles[`badge-${badgeKind}`] : ""].join(" ")}>
            {badge}
          </span>
        )}
      </dd>
    </>
  );
}
