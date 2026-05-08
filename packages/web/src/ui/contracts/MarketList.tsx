import { useState, useCallback } from "react";
import type { Capacity, Contract, Datacenter } from "@datacenter-tycoon/game-logic";
import { useSelector, useGameDispatch } from "../../store/storeContext.js";
import {
  selectAllDatacenters,
  selectActiveContracts,
  selectTick,
  selectReliabilitySummary,
} from "../../store/selectors.js";
import { canFulfill, dcFreeCapacity, contractDealScore } from "./contractUtils.js";
import { playSound } from "../../audio/AudioEngine.js";
import { useTickFraction } from "../../store/tickFractionStore.js";
import { monthsAndDaysBetween, formatRemaining } from "../../store/gameTime.js";
import styles from "./MarketList.module.css";

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

function fitStatus(
  contract: Contract,
  datacenters: Datacenter[],
  activeContracts: Contract[],
): "fits" | "partial" | "none" {
  const reqs = contract.requirements;
  let anyFits  = false;
  let totalFree = { vCpu: 0, ramGb: 0, storageTb: 0, gpuFlops: 0 };

  for (const dc of datacenters) {
    const free = dcFreeCapacity(dc, activeContracts);
    totalFree.vCpu      += free.vCpu;
    totalFree.ramGb     += free.ramGb;
    totalFree.storageTb += free.storageTb;
    totalFree.gpuFlops  += free.gpuFlops;
    if (canFulfill(free, reqs)) anyFits = true;
  }

  if (anyFits)                     return "fits";
  if (canFulfill(totalFree, reqs)) return "partial";
  return "none";
}

const FIT_ICON:  Record<string, string> = { fits: "✅", partial: "⚠", none: "❌" };
const FIT_LABEL: Record<string, string> = { fits: "DC available", partial: "No single DC fits", none: "Insufficient capacity" };

const CATEGORY_MAP: Record<string, { abbr: string; color: string }> = {
  "AI Model Training Job":          { abbr: "AI", color: "purple" },
  "Realtime Analytics Cluster":     { abbr: "AN", color: "cyan"   },
  "Edge Compute Burst":             { abbr: "EC", color: "lime"   },
  "Small Data Storage Startup":     { abbr: "ST", color: "blue"   },
  "Rendering Farm":                 { abbr: "RF", color: "amber"  },
  "In-Memory Database Migration":   { abbr: "DB", color: "pink"   },
};

function dealScoreLabel(score: number): string {
  if (score >= 1.4) return "★ Great";
  if (score >= 1.2) return "★ Good";
  if (score >= 1.0) return "Fair";
  return "Low";
}

function sumFreeCapacity(datacenters: Datacenter[], activeContracts: Contract[]): Capacity {
  return datacenters.reduce<Capacity>((acc, dc) => {
    const free = dcFreeCapacity(dc, activeContracts);
    return {
      vCpu: acc.vCpu + free.vCpu,
      ramGb: acc.ramGb + free.ramGb,
      storageTb: acc.storageTb + free.storageTb,
      gpuFlops: acc.gpuFlops + free.gpuFlops,
    };
  }, { vCpu: 0, ramGb: 0, storageTb: 0, gpuFlops: 0 });
}

export function MarketList({ contracts }: { contracts: Contract[] }) {
  const datacenters     = useSelector(selectAllDatacenters);
  const activeContracts = useSelector(selectActiveContracts);
  const tick            = useSelector(selectTick);
  const reliability     = useSelector(selectReliabilitySummary);
  const dispatch        = useGameDispatch();
  const fraction        = useTickFraction();

  const [accepting, setAccepting] = useState<string | null>(null);
  const [pendingAssignment, setPendingAssignment] = useState<{
    contractId: string;
    dcId: string;
    dcName: string;
  } | null>(null);

  const handleAccept = useCallback((contractId: string, dcId: string) => {
    dispatch({ type: "AcceptContract", contractId: contractId as Contract["id"], dcId: dcId as Datacenter["id"] });
    setAccepting(null);
    setPendingAssignment(null);
  }, [dispatch]);

  if (contracts.length === 0) {
    return <p className={styles.empty}>No contracts match the current filter.</p>;
  }

  return (
    <div className={styles.list}>
      {contracts.map(c => {
        const fit = fitStatus(c, datacenters, activeContracts);
        const { months, days } = monthsAndDaysBetween(tick, fraction, c.expiresAtTick, 0);
        const expired = months <= 0 && days <= 0;
        const expiryLabel = expired ? "EXPIRED" : formatRemaining(months, days);
        const urgent = !expired && months === 0 && days <= 7;
        const isAccepting = accepting === c.id;
        const networkFree = sumFreeCapacity(datacenters, activeContracts);
        const isConfirming = pendingAssignment?.contractId === c.id;
        const score = contractDealScore(c);
        const cat = CATEGORY_MAP[c.name];
        const reliabilityHint = reliability.band === "at-risk"
          ? {
              tone: styles.reliabilityHintNegative,
              text: "At-risk reliability is limiting longer-term work until SLA performance improves.",
            }
          : reliability.band === "trusted" && (c.urgency === "anchor" || c.termMonths >= 8)
            ? {
                tone: styles.reliabilityHintPositive,
                text: "Trusted reliability is helping surface longer-term offers like this.",
              }
            : null;
        return (
          <div key={c.id} className={[styles.card, styles[`fit-${fit}`]].join(" ")}>
            <div className={styles.cardTop}>
              <div className={styles.cardLeft}>
                {cat && (
                  <span className={[styles.categoryBadge, styles[`cat-${cat.color}`]].join(" ")}>
                    {cat.abbr}
                  </span>
                )}
                <span className={styles.fitBadge} title={FIT_LABEL[fit]}>{FIT_ICON[fit]}</span>
                <div>
                  <div className={styles.name}>{c.name}</div>
                  <div className={styles.meta}>
                    <span>{c.termMonths} mo</span>
                    <span className={styles.dot}>·</span>
                    <span className={urgent ? styles.expiring : styles.expiry}>
                      {expiryLabel}
                    </span>
                    {c.urgency === "rush" && (
                      <>
                        <span className={styles.dot}>·</span>
                        <span className={styles.rushBadge}>RUSH</span>
                      </>
                    )}
                    {c.urgency === "anchor" && (
                      <>
                        <span className={styles.dot}>·</span>
                        <span className={styles.anchorBadge}>ANCHOR</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className={styles.financials}>
                <div className={styles.payment}>{fmt(c.monthlyPayment)}<span className={styles.unit}>/mo</span></div>
                <div className={styles.dealScore}>{dealScoreLabel(score)}</div>
                <div className={styles.penalty}>−{fmt(c.penaltyPerMonth)}<span className={styles.unit}>/mo breach</span></div>
              </div>
            </div>

            <RequirementsRow reqs={c.requirements} />
            <CapacityComparison reqs={c.requirements} free={networkFree} />

            {reliabilityHint && (
              <div className={[styles.reliabilityHint, reliabilityHint.tone].join(" ")}>{reliabilityHint.text}</div>
            )}

            {!isAccepting && !isConfirming ? (
              <button
                className={styles.acceptBtn}
                onClick={() => setAccepting(c.id)}
                disabled={fit === "none" || datacenters.length === 0}
              >
                ACCEPT CONTRACT
              </button>
            ) : isConfirming && pendingAssignment ? (
              <ConfirmAssignment
                contractName={c.name}
                dcName={pendingAssignment.dcName}
                onConfirm={() => handleAccept(c.id, pendingAssignment.dcId)}
                onBack={() => setPendingAssignment(null)}
                onCancel={() => {
                  setAccepting(null);
                  setPendingAssignment(null);
                }}
              />
            ) : (
              <DcSelector
                contract={c}
                datacenters={datacenters}
                activeContracts={activeContracts}
                onSelect={(dcId, dcName) => setPendingAssignment({ contractId: c.id, dcId, dcName })}
                onCancel={() => {
                  setAccepting(null);
                  setPendingAssignment(null);
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function RequirementsRow({ reqs }: { reqs: Contract["requirements"] }) {
  const items = [
    reqs.vCpu      > 0 && { label: "vCPU",    val: reqs.vCpu.toLocaleString(),           color: "cyan"   },
    reqs.ramGb     > 0 && { label: "RAM",     val: `${reqs.ramGb.toLocaleString()} GB`, color: "blue"   },
    reqs.storageTb > 0 && { label: "STORAGE", val: `${reqs.storageTb} TB`,               color: "purple" },
    reqs.gpuFlops  > 0 && { label: "GPU",     val: `${reqs.gpuFlops} TFLOPS`,            color: "amber"  },
  ].filter(Boolean) as { label: string; val: string; color: string }[];
  return (
    <div className={styles.reqs}>
      {items.map(it => (
        <span key={it.label} className={[styles.req, styles[`req-${it.color}`]].join(" ")}>
          <span className={styles.reqLabel}>{it.label}</span>
          <span className={styles.reqVal}>{it.val}</span>
        </span>
      ))}
    </div>
  );
}

function CapacityComparison({ reqs, free }: { reqs: Contract["requirements"]; free: Capacity }) {
  const items = [
    { label: "vCPU", req: reqs.vCpu, free: free.vCpu, suffix: "" },
    { label: "RAM", req: reqs.ramGb, free: free.ramGb, suffix: " GB" },
    { label: "STORAGE", req: reqs.storageTb, free: free.storageTb, suffix: " TB" },
    { label: "GPU", req: reqs.gpuFlops, free: free.gpuFlops, suffix: " TFLOPS" },
  ].filter(item => item.req > 0);

  return (
    <div className={styles.capacityCompare}>
      <span className={styles.capacityLabel}>FREE CAPACITY</span>
      <div className={styles.capacityList}>
        {items.map(item => {
          const ok = item.free >= item.req;
          return (
            <span
              key={item.label}
              className={[styles.capacityChip, ok ? styles.capacityChipOk : styles.capacityChipNo].join(" ")}
            >
              <span className={styles.capacityChipLabel}>{item.label}</span>
              <span>{item.free.toLocaleString()}{item.suffix}</span>
              <span className={styles.capacityChipDivider}>/</span>
              <span>{item.req.toLocaleString()}{item.suffix}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function ConfirmAssignment({
  contractName,
  dcName,
  onConfirm,
  onBack,
  onCancel,
}: {
  contractName: string;
  dcName: string;
  onConfirm: () => void;
  onBack: () => void;
  onCancel: () => void;
}) {
  return (
    <div className={styles.dcSelector}>
      <span className={styles.dcSelectorLabel}>Ready to activate contract:</span>
      <div className={styles.confirmSummary}>
        <strong>{contractName}</strong>
        <span>→ {dcName}</span>
      </div>
      <div className={styles.confirmActions}>
        <button className={styles.confirmAcceptBtn} onClick={onConfirm}>CONFIRM ACCEPT</button>
        <button className={styles.confirmBackBtn} onClick={onBack}>Choose another DC</button>
        <button className={styles.dcCancelBtn} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function DcSelector({
  contract, datacenters, activeContracts, onSelect, onCancel,
}: {
  contract:        Contract;
  datacenters:     Datacenter[];
  activeContracts: Contract[];
  onSelect:        (dcId: string, dcName: string) => void;
  onCancel:        () => void;
}) {
  return (
    <div className={styles.dcSelector}>
      <span className={styles.dcSelectorLabel}>Assign to datacenter:</span>
      <div className={styles.dcList}>
        {datacenters.map(dc => {
          const free = dcFreeCapacity(dc, activeContracts);
          const ok   = canFulfill(free, contract.requirements);
          return (
            <button
              key={dc.id}
              className={[styles.dcBtn, ok ? styles.dcBtnOk : styles.dcBtnNo].join(" ")}
              onClick={() => ok && onSelect(dc.id, dc.name)}
              disabled={!ok}
              title={ok ? `Assign to ${dc.name}` : "Insufficient free capacity"}
            >
              {dc.name}
              <span className={styles.dcBtnStatus}>{ok ? "✓ fits" : "✗ no room"}</span>
            </button>
          );
        })}
      </div>
      <button className={styles.dcCancelBtn} onClick={onCancel}>Cancel</button>
    </div>
  );
}
