import { memo, useCallback, useState } from "react";
import { DAYS_PER_TICK } from "@datacenter-tycoon/game-logic";
import type {
  Capacity,
  Contract,
  Datacenter,
} from "@datacenter-tycoon/game-logic";
import { useSelector, useGameDispatch } from "../../store/storeContext.js";
import {
  selectAllDatacenters,
  selectReliabilitySummary,
  selectSubtick,
  selectTick,
  type ContractAssignmentOptionView,
  type MarketContractView,
} from "../../store/selectors.js";
import { useTickFraction } from "../../store/tickFractionStore.js";
import { monthsAndDaysBetween, formatRemaining } from "../../store/gameTime.js";
import styles from "./MarketList.module.css";

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

const ZERO_CAPACITY: Capacity = { vCpu: 0, ramGb: 0, storageTb: 0, gpuFlops: 0 };
type FitDisplayStatus = "fits" | "partial" | "none" | "wrong-region";
const FIT_ICON: Record<FitDisplayStatus, string> = {
  fits: "✅",
  partial: "⚠",
  none: "❌",
  "wrong-region": "🌍",
};
const FIT_LABEL: Record<FitDisplayStatus, string> = {
  fits: "DC available",
  partial: "No single DC fits",
  none: "Insufficient capacity",
  "wrong-region": "No eligible datacenter region",
};

const CATEGORY_MAP: Record<string, { abbr: string; color: string }> = {
  "AI Model Training Job": { abbr: "AI", color: "purple" },
  "Realtime Analytics Cluster": { abbr: "AN", color: "cyan" },
  "Edge Compute Burst": { abbr: "EC", color: "lime" },
  "Small Data Storage Startup": { abbr: "ST", color: "blue" },
  "Rendering Farm": { abbr: "RF", color: "amber" },
  "In-Memory Database Migration": { abbr: "DB", color: "pink" },
};

function dealScoreLabel(score: number): string {
  if (score >= 1.4) return "★ Great";
  if (score >= 1.2) return "★ Good";
  if (score >= 1.0) return "Fair";
  return "Low";
}

function fitDisplayStatus(
  restricted: boolean,
  eligibleDatacenterIds: readonly string[],
  fitStatus: "fits" | "partial" | "none",
  datacenterCount: number,
): FitDisplayStatus {
  if (restricted && datacenterCount > 0 && eligibleDatacenterIds.length === 0) {
    return "wrong-region";
  }

  return fitStatus;
}

export function MarketList({ contractViews }: { contractViews: MarketContractView[] }) {
  const datacenterCount = useSelector(selectAllDatacenters).length;
  const tick = useSelector(selectTick);
  const subtick = useSelector(selectSubtick);
  const reliability = useSelector(selectReliabilitySummary);
  const dispatch = useGameDispatch();
  const fraction = useTickFraction();

  const [accepting, setAccepting] = useState<string | null>(null);

  const handleAccept = useCallback((contractId: string, dcId: string) => {
    dispatch({
      type: "AcceptContract",
      contractId: contractId as Contract["id"],
      dcId: dcId as Datacenter["id"],
    });
    setAccepting(null);
  }, [dispatch]);

  if (contractViews.length === 0) {
    return <p className={styles.empty}>No contracts match the current filter.</p>;
  }

  return (
    <div className={styles.list}>
      {contractViews.map((view) => {
        const contract = view.contract;
        const fit = fitDisplayStatus(
          view.affinity.restricted,
          view.eligibleDatacenterIds,
          view.fitSummary.fitStatus,
          datacenterCount,
        );
        const { months, days } = monthsAndDaysBetween(tick, (subtick + fraction) / DAYS_PER_TICK, contract.expiresAtTick, 0);
        const expired = months <= 0 && days <= 0;
        const expiryLabel = expired ? "EXPIRED" : formatRemaining(months, days);
        const urgent = !expired && months === 0 && days <= 7;
        const isAccepting = accepting === contract.id;
        const category = CATEGORY_MAP[contract.name];
        const reliabilityHint = (reliability.band === "silver" || reliability.band === "bronze")
          ? {
              tone: styles.reliabilityHintNegative,
              text: "Low reliability is limiting longer-term work until SLA performance improves.",
            }
          : (reliability.band === "platinum" || reliability.band === "diamond") && (contract.urgency === "anchor" || contract.termMonths >= 8)
            ? {
                tone: styles.reliabilityHintPositive,
                text: `${reliability.band.charAt(0).toUpperCase() + reliability.band.slice(1)} reliability is helping surface longer-term offers like this.`,
              }
            : null;

        return (
          <div key={contract.id} className={[styles.card, styles[`fit-${fit}`]].join(" ")}>
            <div className={styles.cardTop}>
              <div className={styles.cardLeft}>
                {category && (
                  <span className={[styles.categoryBadge, styles[`cat-${category.color}`]].join(" ")}>
                    {category.abbr}
                  </span>
                )}
                <span className={styles.fitBadge} title={FIT_LABEL[fit]}>{FIT_ICON[fit]}</span>
                <div>
                  <div className={styles.name}>{contract.name}</div>
                  <div className={styles.meta}>
                    <span>{contract.termMonths} mo</span>
                    <span className={styles.dot}>·</span>
                    <span className={urgent ? styles.expiring : styles.expiry}>{expiryLabel}</span>
                    {contract.urgency === "rush" && (
                      <>
                        <span className={styles.dot}>·</span>
                        <span className={styles.rushBadge}>RUSH</span>
                      </>
                    )}
                    {contract.urgency === "anchor" && (
                      <>
                        <span className={styles.dot}>·</span>
                        <span className={styles.anchorBadge}>ANCHOR</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className={styles.financials}>
                <div className={styles.payment}>{fmt(contract.monthlyPayment)}<span className={styles.unit}>/mo</span></div>
                <div className={styles.dealScore}>{dealScoreLabel(view.dealScore)}</div>
                <div className={styles.penalty}>−{fmt(contract.penaltyPerMonth)}<span className={styles.unit}>/mo breach</span></div>
              </div>
            </div>

            <RequirementsRow reqs={contract.requirements} />
            <AffinitySummary
              restricted={view.affinity.restricted}
              badgeLabel={view.affinity.badgeLabel}
              detail={view.affinityDetail}
            />
            <CapacityComparison reqs={contract.requirements} free={view.networkAvailable ?? ZERO_CAPACITY} />
            <div className={styles.meta}>
              <span>{view.slaProgress.slaTargetPercent}% SLA</span>
              <span className={styles.dot}>·</span>
              <span>up to {view.slaProgress.maxFailedDays} failed day{view.slaProgress.maxFailedDays === 1 ? "" : "s"}/mo</span>
              <span className={styles.dot}>·</span>
              <span>{contract.slaTargetPercent >= 95 ? "strict penalty protection" : contract.slaTargetPercent <= 80 ? "forgiving anchor uptime" : "balanced uptime target"}</span>
            </div>

            {reliabilityHint && (
              <div className={[styles.reliabilityHint, reliabilityHint.tone].join(" ")}>{reliabilityHint.text}</div>
            )}

            {!isAccepting ? (
              <button
                className={styles.acceptBtn}
                onClick={() => setAccepting(contract.id)}
                disabled={fit !== "fits" || datacenterCount === 0}
              >
                ACCEPT CONTRACT
              </button>
            ) : (
              <DcSelector
                contract={contract}
                eligibleOptions={view.eligibleAssignmentOptions}
                blockedOptions={view.blockedAssignmentOptions}
                onSelect={(dcId) => handleAccept(contract.id, dcId)}
                onCancel={() => setAccepting(null)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

const RequirementsRow = memo(function RequirementsRow({ reqs }: { reqs: Contract["requirements"] }) {
  const items = [
    reqs.vCpu > 0 && { label: "vCPU", val: reqs.vCpu.toLocaleString(), color: "cyan" },
    reqs.ramGb > 0 && { label: "RAM", val: `${reqs.ramGb.toLocaleString()} GB`, color: "blue" },
    reqs.storageTb > 0 && { label: "STORAGE", val: `${reqs.storageTb} TB`, color: "purple" },
    reqs.gpuFlops > 0 && { label: "GPU", val: `${reqs.gpuFlops} TFLOPS`, color: "amber" },
  ].filter(Boolean) as { label: string; val: string; color: string }[];

  return (
    <div className={styles.reqs}>
      {items.map((item) => (
        <span key={item.label} className={[styles.req, styles[`req-${item.color}`]].join(" ")}>
          <span className={styles.reqLabel}>{item.label}</span>
          <span className={styles.reqVal}>{item.val}</span>
        </span>
      ))}
    </div>
  );
});
const AffinitySummary = memo(function AffinitySummary({
  restricted,
  badgeLabel,
  detail,
}: {
  restricted: boolean;
  badgeLabel: string;
  detail: string;
}) {
  return (
    <div className={styles.affinityRow}>
      <span className={[
        styles.affinityBadge,
        restricted ? styles.affinityBadgeRestricted : styles.affinityBadgeUnrestricted,
      ].join(" ")}>{badgeLabel}</span>
      <span className={styles.affinityDetail}>{detail}</span>
    </div>
  );
});
const CapacityComparison = memo(function CapacityComparison({ reqs, free }: { reqs: Contract["requirements"]; free: Capacity }) {
  const items = [
    { label: "vCPU", req: reqs.vCpu, free: free.vCpu, suffix: "" },
    { label: "RAM", req: reqs.ramGb, free: free.ramGb, suffix: " GB" },
    { label: "STORAGE", req: reqs.storageTb, free: free.storageTb, suffix: " TB" },
    { label: "GPU", req: reqs.gpuFlops, free: free.gpuFlops, suffix: " TFLOPS" },
  ].filter((item) => item.req > 0);

  return (
    <div className={styles.capacityCompare}>
      <span className={styles.capacityLabel}>FREE CAPACITY</span>
      <div className={styles.capacityList}>
        {items.map((item) => {
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
});
const DcSelector = memo(function DcSelector({
  contract,
  eligibleOptions,
  blockedOptions,
  onSelect,
  onCancel,
}: {
  contract: Contract;
  eligibleOptions: ContractAssignmentOptionView[];
  blockedOptions: ContractAssignmentOptionView[];
  onSelect: (dcId: string) => void;
  onCancel: () => void;
}) {
  return (
    <div className={styles.dcSelector}>
      <span className={styles.dcSelectorLabel}>Click an eligible datacenter to accept this contract:</span>
      <span className={styles.dcSelectorHelp}>
        {blockedOptions.length > 0
          ? "Only datacenters in the allowed regions can accept this contract."
          : "The datacenter you choose becomes the live assignment immediately."}
      </span>
      {eligibleOptions.length === 0 ? (
        <div className={styles.dcSelectorWarning}>No datacenters exist in this contract&apos;s allowed regions yet.</div>
      ) : (
        <div className={styles.dcList}>
          {eligibleOptions.map((option) => (
            <button
              key={option.dcId}
              className={[styles.dcBtn, option.fits ? styles.dcBtnOk : styles.dcBtnNo].join(" ")}
              onClick={() => option.fits && onSelect(option.dcId)}
              disabled={!option.fits}
              title={option.fits ? `Accept with ${option.dcName}` : option.disabledMessage ?? `Insufficient free capacity for ${contract.name}`}
            >
              {option.dcName}
              <span className={styles.dcBtnMeta}>{option.regionLabel}</span>
              <span className={styles.dcBtnStatus}>{option.fits ? "✓ click to accept" : "✗ no room"}</span>
            </button>
          ))}
        </div>
      )}
      {blockedOptions.length > 0 && (
        <div className={styles.dcBlockedSection}>
          <span className={styles.dcBlockedLabel}>Unavailable outside allowed regions</span>
          <div className={styles.dcBlockedList}>
            {blockedOptions.map((option) => (
              <div key={option.dcId} className={styles.dcBlockedItem}>
                <span className={styles.dcBlockedName}>{option.dcName}</span>
                <span className={styles.dcBlockedMeta}>{option.regionLabel}</span>
                <span className={styles.dcBlockedReason}>{option.disabledMessage}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <button className={styles.dcCancelBtn} onClick={onCancel}>Cancel</button>
    </div>
  );
});