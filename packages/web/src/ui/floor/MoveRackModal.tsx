import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  RACK_CATALOG,
  canPlaceRack,
  calculateMoveCost,
} from "@datacenter-tycoon/game-logic";
import type {
  Datacenter,
  DatacenterId,
  RackPlacementId,
  Region,
} from "@datacenter-tycoon/game-logic";
import { useSelector, useGameDispatch } from "../../store/storeContext.js";
import {
  selectCash,
  selectAllDatacenters,
  selectDatacenter,
  selectRegions,
} from "../../store/selectors.js";
import { useDialogFocus } from "../dialogFocus.js";
import styles from "./MoveRackModal.module.css";

interface MoveRackModalProps {
  sourceDcId: DatacenterId;
  placementId: RackPlacementId;
  onClose: () => void;
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

/** Find the first empty slot in a datacenter for a given rack spec. */
function findFirstAvailableSlot(
  dc: Datacenter,
  specId: string,
): { row: number; position: number } | null {
  const spec = RACK_CATALOG[specId];
  if (!spec) return null;

  const occupied = new Set(dc.placements.map((p) => `${p.row},${p.position}`));

  for (let r = 0; r < dc.spec.rows; r++) {
    for (let p = 0; p < dc.spec.positionsPerRow; p++) {
      if (occupied.has(`${r},${p}`)) continue;
      const check = canPlaceRack(dc, spec, { row: r, position: p });
      if (check.ok) return { row: r, position: p };
    }
  }
  return null;
}

/** Count total available slots in a datacenter for a given rack spec. */
function countAvailableSlots(dc: Datacenter, specId: string): number {
  const spec = RACK_CATALOG[specId];
  if (!spec) return 0;

  const occupied = new Set(dc.placements.map((p) => `${p.row},${p.position}`));
  let count = 0;

  for (let r = 0; r < dc.spec.rows; r++) {
    for (let p = 0; p < dc.spec.positionsPerRow; p++) {
      if (occupied.has(`${r},${p}`)) continue;
      const check = canPlaceRack(dc, spec, { row: r, position: p });
      if (check.ok) count++;
    }
  }
  return count;
}

interface CandidateInfo {
  dc: Datacenter;
  region: Region | undefined;
  availableSlots: number;
  cost: number;
  sameRegion: boolean;
}

export function MoveRackModal({ sourceDcId, placementId, onClose }: MoveRackModalProps) {
  const dispatch = useGameDispatch();
  const cash = useSelector(selectCash);
  const allDatacenters = useSelector(selectAllDatacenters);
  const regions = useSelector(selectRegions);
  const sourceDc = useSelector((s) => selectDatacenter(s, sourceDcId));

  const placement = sourceDc?.placements.find((p) => p.id === placementId);
  const spec = placement ? RACK_CATALOG[placement.specId] : undefined;
  const sourceRegion = regions.find((r) => r.id === sourceDc?.regionId);

  const candidates: CandidateInfo[] = useMemo(() => {
    if (!spec || !sourceDc) return [];
    return allDatacenters
      .filter((dc) => dc.id !== sourceDcId)
      .map((dc) => {
        const region = regions.find((r) => r.id === dc.regionId);
        return {
          dc,
          region,
          availableSlots: countAvailableSlots(dc, spec.id),
          cost: calculateMoveCost(spec, sourceDc.regionId, dc.regionId),
          sameRegion: sourceDc.regionId === dc.regionId,
        };
      });
  }, [allDatacenters, sourceDcId, spec, sourceDc, regions]);

  const [selectedDcId, setSelectedDcId] = useState<DatacenterId | null>(
    candidates.find((c) => c.availableSlots > 0)?.dc.id ?? null,
  );
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useDialogFocus(closeButtonRef);

  const selectedCandidate = candidates.find((c) => c.dc.id === selectedDcId);
  const selectedDc = selectedCandidate?.dc;

  const targetSlot = useMemo(() => {
    if (!selectedDc || !spec) return null;
    return findFirstAvailableSlot(selectedDc, spec.id);
  }, [selectedDc, spec]);

  const moveCost = selectedCandidate?.cost ?? 0;
  const canAfford = cash >= moveCost;
  const isSameRegion = selectedCandidate?.sameRegion ?? false;

  // ESC closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    if (!selectedDc || !targetSlot || !canAfford || !placement) return;
    dispatch({
      type: "MoveRack",
      dcId: sourceDcId,
      placementId: placement.id,
      targetDcId: selectedDc.id,
      row: targetSlot.row,
      position: targetSlot.position,
    });
    onClose();
  }, [dispatch, sourceDcId, placement, selectedDc, targetSlot, canAfford, onClose]);

  if (!placement || !spec || !sourceDc) {
    return null;
  }

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-rack-title"
      >
        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h2 id="move-rack-title" className={styles.title}>MOVE RACK</h2>
            <span className={styles.rackName}>{spec.name}</span>
            <span className={styles.budget}>
              Budget: <strong className={styles.budgetAmt}>{formatMoney(cash)}</strong>
            </span>
          </div>
          <button
            ref={closeButtonRef}
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close modal"
          >✕</button>
        </div>

        {/* ── Source info ── */}
        <div className={styles.sourceInfo}>
          <span className={styles.sourceLabel}>FROM</span>
          <span className={styles.sourceValue}>{sourceDc.name}</span>
          <span className={styles.sourceRegion}>{sourceRegion?.name ?? sourceDc.regionId}</span>
        </div>

        {/* ── Target DC cards ── */}
        <div className={styles.candidates}>
          {candidates.length === 0 && (
            <p className={styles.noCandidates}>No other datacenters available.</p>
          )}
          {candidates.map((candidate) => {
            const { dc, region, availableSlots, cost, sameRegion } = candidate;
            const isSelected = dc.id === selectedDcId;
            const canFit = availableSlots > 0;

            return (
              <button
                key={dc.id}
                className={[
                  styles.card,
                  isSelected ? styles.cardSelected : "",
                  !canFit ? styles.cardDisabled : "",
                ].filter(Boolean).join(" ")}
                onClick={() => canFit && setSelectedDcId(dc.id)}
                aria-pressed={isSelected}
                disabled={!canFit}
              >
                <div className={styles.cardHeader}>
                  <span className={styles.cardName}>{dc.name}</span>
                  <span className={[
                    styles.regionBadge,
                    sameRegion ? styles.regionSame : styles.regionCross,
                  ].join(" ")}>
                    {sameRegion ? "SAME REGION" : "CROSS-REGION"}
                  </span>
                </div>
                <div className={styles.cardMeta}>
                  <span>{region?.name ?? dc.regionId}</span>
                  <span>{availableSlots} slot{availableSlots !== 1 ? "s" : ""} free</span>
                </div>
                <div className={styles.cardCost}>
                  <span className={styles.costLabel}>MOVE COST</span>
                  <span className={[
                    styles.costValue,
                    cash >= cost ? styles.costOk : styles.costNo,
                  ].join(" ")}>
                    {formatMoney(cost)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Selected target details ── */}
        {selectedDc && targetSlot && (
          <div className={styles.targetDetail}>
            <span>
              Target slot: Row {String.fromCharCode(65 + targetSlot.row)}, Position {targetSlot.position + 1}
            </span>
            <span className={isSameRegion ? styles.sameRegion : styles.crossRegion}>
              {isSameRegion ? "Same region — discounted rate" : "Cross-region — standard rate"}
            </span>
          </div>
        )}

        {selectedDc && !targetSlot && (
          <div className={styles.targetDetail}>
            <span className={styles.noSlot}>No valid slot available in this datacenter.</span>
          </div>
        )}

        {/* ── Footer ── */}
        <div className={styles.footer}>
          {!canAfford && moveCost > 0 && (
            <span className={styles.insufficient}>
              Insufficient funds — need {formatMoney(moveCost - cash)} more
            </span>
          )}
          <div className={styles.footerBtns}>
            <button className={styles.cancelBtn} onClick={onClose}>
              CANCEL
            </button>
            <button
              className={styles.confirmBtn}
              onClick={handleConfirm}
              disabled={!canAfford || !targetSlot}
              title={
                !canAfford
                  ? `Need ${formatMoney(moveCost - cash)} more`
                  : !targetSlot
                    ? "No available slot"
                    : undefined
              }
            >
              MOVE — {formatMoney(moveCost)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
