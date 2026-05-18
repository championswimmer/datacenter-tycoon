import { useEffect, useState, useCallback, useRef } from "react";
import { RACK_CATALOG } from "@datacenter-tycoon/game-logic";
import type {
  DatacenterId,
  RackPlacementId,
  Region,
} from "@datacenter-tycoon/game-logic";
import { useSelector, useGameDispatch } from "../../store/storeContext.js";
import {
  selectCash,
  selectDatacenter,
  selectDatacenterByIdIndex,
  selectRackMoveTargets,
  selectRegionById,
  selectRegionByIdIndex,
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
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

interface CandidateInfo {
  dcId: DatacenterId;
  name: string;
  region: Region | undefined;
  availableSlots: number;
  moveCost: number;
  sameRegion: boolean;
  firstAvailableSlot: { row: number; position: number } | null;
}

export function MoveRackModal({ sourceDcId, placementId, onClose }: MoveRackModalProps) {
  const dispatch = useGameDispatch();
  const cash = useSelector(selectCash);
  const datacenterById = useSelector(selectDatacenterByIdIndex);
  const regionById = useSelector(selectRegionByIdIndex);
  const sourceDc = useSelector((state) => selectDatacenter(state, sourceDcId));
  const sourceRegion = useSelector((state) => (
    sourceDc ? selectRegionById(state, sourceDc.regionId) : undefined
  ));
  const moveTargets = useSelector((state) => selectRackMoveTargets(state, sourceDcId, placementId));

  const placement = sourceDc?.placements.find((entry) => entry.id === placementId);
  const spec = placement ? RACK_CATALOG[placement.specId] : undefined;

  const candidates: CandidateInfo[] = moveTargets.map((target) => {
    const datacenter = datacenterById.get(target.targetDcId);
    return {
      dcId: target.targetDcId,
      name: datacenter?.name ?? target.targetDcId,
      region: regionById.get(target.targetRegionId),
      availableSlots: target.availableSlots,
      moveCost: target.moveCost,
      sameRegion: target.sameRegion,
      firstAvailableSlot: target.firstAvailableSlot,
    };
  });

  const [selectedDcId, setSelectedDcId] = useState<DatacenterId | null>(
    candidates.find((candidate) => candidate.availableSlots > 0)?.dcId ?? null,
  );
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useDialogFocus(closeButtonRef);

  useEffect(() => {
    if (selectedDcId && candidates.some((candidate) => candidate.dcId === selectedDcId && candidate.availableSlots > 0)) {
      return;
    }
    setSelectedDcId(candidates.find((candidate) => candidate.availableSlots > 0)?.dcId ?? null);
  }, [candidates, selectedDcId]);

  const selectedCandidate = candidates.find((candidate) => candidate.dcId === selectedDcId);
  const moveCost = selectedCandidate?.moveCost ?? 0;
  const canAfford = cash >= moveCost;
  const isSameRegion = selectedCandidate?.sameRegion ?? false;
  const targetSlot = selectedCandidate?.firstAvailableSlot ?? null;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    if (!selectedCandidate || !targetSlot || !canAfford || !placement) return;
    dispatch({
      type: "MoveRack",
      dcId: sourceDcId,
      placementId: placement.id,
      targetDcId: selectedCandidate.dcId,
      row: targetSlot.row,
      position: targetSlot.position,
    });
    onClose();
  }, [canAfford, dispatch, onClose, placement, selectedCandidate, sourceDcId, targetSlot]);

  if (!placement || !spec || !sourceDc) {
    return null;
  }

  return (
    <div
      className={styles.backdrop}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      role="presentation"
    >
      <div className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="move-rack-title">
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

        <div className={styles.sourceInfo}>
          <span className={styles.sourceLabel}>FROM</span>
          <span className={styles.sourceValue}>{sourceDc.name}</span>
          <span className={styles.sourceRegion}>{sourceRegion?.name ?? sourceDc.regionId}</span>
        </div>

        <div className={styles.candidates}>
          {candidates.length === 0 && (
            <p className={styles.noCandidates}>No other datacenters available.</p>
          )}
          {candidates.map((candidate) => {
            const isSelected = candidate.dcId === selectedDcId;
            const canFit = candidate.availableSlots > 0;

            return (
              <button
                key={candidate.dcId}
                className={[
                  styles.card,
                  isSelected ? styles.cardSelected : "",
                  !canFit ? styles.cardDisabled : "",
                ].filter(Boolean).join(" ")}
                onClick={() => canFit && setSelectedDcId(candidate.dcId)}
                aria-pressed={isSelected}
                disabled={!canFit}
              >
                <div className={styles.cardHeader}>
                  <span className={styles.cardName}>{candidate.name}</span>
                  <span className={[
                    styles.regionBadge,
                    candidate.sameRegion ? styles.regionSame : styles.regionCross,
                  ].join(" ")}>
                    {candidate.sameRegion ? "SAME REGION" : "CROSS-REGION"}
                  </span>
                </div>
                <div className={styles.cardMeta}>
                  <span>{candidate.region?.name ?? candidate.dcId}</span>
                  <span>{candidate.availableSlots} slot{candidate.availableSlots !== 1 ? "s" : ""} free</span>
                </div>
                <div className={styles.cardCost}>
                  <span className={styles.costLabel}>MOVE COST</span>
                  <span className={[
                    styles.costValue,
                    cash >= candidate.moveCost ? styles.costOk : styles.costNo,
                  ].join(" ")}>
                    {formatMoney(candidate.moveCost)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {selectedCandidate && targetSlot && (
          <div className={styles.targetDetail}>
            <span>Target slot: Row {String.fromCharCode(65 + targetSlot.row)}, Position {targetSlot.position + 1}</span>
            <span className={isSameRegion ? styles.sameRegion : styles.crossRegion}>
              {isSameRegion ? "Same region — discounted rate" : "Cross-region — standard rate"}
            </span>
          </div>
        )}

        {selectedCandidate && !targetSlot && (
          <div className={styles.targetDetail}>
            <span className={styles.noSlot}>No valid slot available in this datacenter.</span>
          </div>
        )}

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
