import { useCallback, useMemo, useState } from "react";
import { canBuildInRegion, DATACENTER_CATALOG, FabricLinkError } from "@datacenter-tycoon/game-logic";
import type { Datacenter, Region } from "@datacenter-tycoon/game-logic";
import { useGameDispatch, useSelector } from "../../store/storeContext.js";
import { selectCash, selectRegionFabricSummary } from "../../store/selectors.js";
import { ProgressBar } from "../../theme/primitives/index.js";
import { navigateToDc } from "../../router/hashRouter.js";
import styles from "./RegionPanel.module.css";

interface RegionPanelProps {
  region: Region;
  datacenters: Datacenter[];
  onClose: () => void;
  onBuild: () => void;
}

export function RegionPanel({ region, datacenters, onClose, onBuild }: RegionPanelProps) {
  const cash = useSelector(selectCash);
  const fabricSummary = useSelector((state) => selectRegionFabricSummary(state, region.id));
  const dispatch = useGameDispatch();
  const [fabricActionError, setFabricActionError] = useState<string | null>(null);
  const regionDcs = useMemo(
    () => datacenters.filter((dc) => dc.regionId === region.id),
    [datacenters, region.id],
  );

  const powerRemaining = region.totalPowerAvailable - region.powerUsed;
  const staffRemaining = region.totalStaffAvailable - region.staffUsed;

  const powerRemainingPct = region.totalPowerAvailable > 0
    ? powerRemaining / region.totalPowerAvailable
    : 0;
  const staffRemainingPct = region.totalStaffAvailable > 0
    ? staffRemaining / region.totalStaffAvailable
    : 0;

  // Color based on how much is USED (not remaining)
  const powerUsedPct = region.totalPowerAvailable > 0
    ? region.powerUsed / region.totalPowerAvailable
    : 0;
  const staffUsedPct = region.totalStaffAvailable > 0
    ? region.staffUsed / region.totalStaffAvailable
    : 0;

  const powerColor = powerUsedPct >= 0.9 ? "red" : powerUsedPct >= 0.7 ? "amber" : "cyan";
  const staffColor = staffUsedPct >= 0.9 ? "red" : staffUsedPct >= 0.7 ? "amber" : "cyan";

  // Check if any datacenter spec can be built in this region
  const canBuildAnything = Object.values(DATACENTER_CATALOG).some((spec) =>
    canBuildInRegion(region, spec, datacenters),
  );

  const handleBuild = useCallback(() => {
    if (!canBuildAnything) return;
    onBuild();
  }, [canBuildAnything, onBuild]);

  const datacenterById = useMemo(
    () => new Map(regionDcs.map((dc) => [dc.id, dc] as const)),
    [regionDcs],
  );
  const bootstrapAnchorDcId = !fabricSummary?.active ? fabricSummary?.eligibleDcIds[0] ?? null : null;
  const canAffordFabricJoin = cash >= (fabricSummary?.joinCost ?? 0);
  const canShowFabricAffordabilityWarning = !!fabricSummary
    && !canAffordFabricJoin
    && fabricSummary.datacenters.some((datacenter) => datacenter.linkMode !== null && !datacenter.fabricConnected);
  const fabricAffordabilityWarning = fabricSummary
    ? `Need $${fabricSummary.joinCost.toLocaleString()} cash to create or extend the regional fabric. Current cash: $${cash.toLocaleString()}.`
    : null;

  const handleFabricLink = useCallback((sourceDcId: Datacenter["id"], targetDcId: Datacenter["id"]) => {
    if (!fabricSummary || cash < fabricSummary.joinCost) {
      return;
    }

    setFabricActionError(null);

    try {
      dispatch({
        type: "FabricLink",
        sourceDcId,
        targetDcId,
      });
    } catch (error) {
      if (error instanceof FabricLinkError) {
        setFabricActionError(error.message);
        return;
      }

      if (error instanceof Error) {
        setFabricActionError(error.message);
        return;
      }

      setFabricActionError("Could not update the regional fabric right now.");
    }
  }, [cash, dispatch, fabricSummary]);

  return (
    <div className={styles.panel}>
      <div className={styles.panelInner}>
        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.headerCopy}>
            <span className={styles.regionMeta}>{region.code} · {region.city}</span>
            <h3 className={styles.name}>{region.name}</h3>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close panel">
            ✕
          </button>
        </div>

        {/* ── Economics ── */}
        <div className={styles.econGrid}>
          <EconTile label="Power Cost" value={`$${region.powerCostPerKwh.toFixed(3)}/kWh`} color="cyan" />
          <EconTile label="Staff Wage" value={`$${region.staffWage.toLocaleString()}/mo`} color="lime" />
          <EconTile label="Tax Rate" value={`${(region.taxRate * 100).toFixed(0)}%`} color="amber" />
        </div>

        {/* ── Availability ── */}
        <div className={styles.availability}>
          <h4 className={styles.sectionTitle}>AVAILABILITY</h4>

          <div className={styles.barGroup}>
            <div className={styles.barHeader}>
              <span className={styles.barLabel}>Grid Power</span>
              <span className={styles.barValue}>
                {powerRemaining.toLocaleString()} / {region.totalPowerAvailable.toLocaleString()} kW
              </span>
            </div>
            <ProgressBar value={powerRemainingPct * 100} max={100} segments={20} color={powerColor} height={6} />
          </div>

          <div className={styles.barGroup}>
            <div className={styles.barHeader}>
              <span className={styles.barLabel}>Skilled Staff</span>
              <span className={styles.barValue}>
                {staffRemaining.toLocaleString()} / {region.totalStaffAvailable.toLocaleString()}
              </span>
            </div>
            <ProgressBar value={staffRemainingPct * 100} max={100} segments={20} color={staffColor} height={6} />
          </div>
        </div>

        {/* ── Regional fabric ── */}
        {fabricSummary && (
          <div className={styles.fabricSection}>
            <div className={styles.fabricHeaderRow}>
              <h4 className={styles.sectionTitle}>REGIONAL FABRIC</h4>
              <span className={styles.fabricState}>{fabricSummary.active ? "ACTIVE" : "INACTIVE"}</span>
            </div>
            <div className={styles.fabricMetaRow}>
              <span>Join cost ${fabricSummary.joinCost.toLocaleString()}</span>
              <span>{fabricSummary.memberDcIds.length} linked datacenters</span>
            </div>
            {fabricSummary.memberDcIds.length > 0 ? (
              <div className={styles.fabricMembers}>
                {fabricSummary.memberDcIds.map((memberDcId) => (
                  <span key={memberDcId} className={styles.fabricMemberChip}>
                    {datacenterById.get(memberDcId)?.name ?? memberDcId}
                  </span>
                ))}
              </div>
            ) : (
              <p className={styles.fabricHint}>No datacenters are connected yet. Link two fiber-ready sites to create the region fabric.</p>
            )}
            {canShowFabricAffordabilityWarning && fabricAffordabilityWarning && (
              <p className={styles.fabricWarning}>{fabricAffordabilityWarning}</p>
            )}
            {fabricActionError && (
              <p className={styles.fabricWarning}>{fabricActionError}</p>
            )}

            <div className={styles.fabricStatusList}>
              {fabricSummary.datacenters.map((fabricDc) => {
                const dc = datacenterById.get(fabricDc.dcId);
                if (!dc) {
                  return null;
                }
                const suggestedTarget = fabricDc.suggestedTargetDcId ? datacenterById.get(fabricDc.suggestedTargetDcId) : undefined;
                const canBootstrapHere = fabricDc.linkMode === "bootstrap" && bootstrapAnchorDcId === fabricDc.dcId && suggestedTarget;
                const canJoinHere = fabricDc.linkMode === "join" && suggestedTarget;
                const showAction = canBootstrapHere || canJoinHere;
                const actionLabel = canBootstrapHere
                  ? `Create fabric with ${dc.name} and ${suggestedTarget?.name}`
                  : canJoinHere
                    ? `Connect ${dc.name} to regional fabric`
                    : null;
                const actionDetail = canBootstrapHere
                  ? `Bootstrap with ${suggestedTarget?.name}`
                  : canJoinHere
                    ? `Link via ${suggestedTarget?.name}`
                    : fabricDc.fabricConnected
                      ? `Connected with ${fabricDc.memberDcIds.length} sites`
                      : fabricDc.linkBlockedReason;
                const actionDisabled = !canAffordFabricJoin;
                const actionDetailLabel = showAction && actionDisabled && fabricAffordabilityWarning
                  ? fabricAffordabilityWarning
                  : actionDetail;

                return (
                  <div key={fabricDc.dcId} className={styles.fabricDcRow}>
                    <div className={styles.fabricDcCopy}>
                      <div className={styles.fabricDcTitleRow}>
                        <span className={styles.fabricDcName}>{dc.name}</span>
                        <span className={styles.fabricDcBadge}>
                          {fabricDc.fabricConnected ? "LINKED" : fabricDc.fabricEligible ? "FIBER READY" : "FIBER LOCKED"}
                        </span>
                      </div>
                      <div className={styles.fabricDcMeta}>{actionDetailLabel}</div>
                    </div>
                    {showAction && suggestedTarget && actionLabel && (
                      <button
                        className={styles.fabricActionBtn}
                        onClick={() => handleFabricLink(canJoinHere ? suggestedTarget.id : dc.id, canJoinHere ? dc.id : suggestedTarget.id)}
                        aria-label={actionLabel}
                        disabled={actionDisabled}
                        title={actionDisabled && fabricAffordabilityWarning ? fabricAffordabilityWarning : undefined}
                      >
                        {fabricSummary.active ? "CONNECT" : "CREATE"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Datacenters in region ── */}
        {regionDcs.length > 0 && (
          <div className={styles.dcList}>
            <h4 className={styles.sectionTitle}>DATACENTERS</h4>
            {regionDcs.map((dc) => (
              <button
                key={dc.id}
                className={styles.dcItem}
                onClick={() => navigateToDc(dc.id)}
              >
                <span className={styles.dcItemName}>{dc.name}</span>
                <span className={styles.dcItemSpec}>{dc.spec.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* ── Build button ── */}
        <div className={styles.footer}>
          {!canBuildAnything && (
            <span className={styles.fullNotice}>Region at capacity — no more builds possible</span>
          )}
          <button
            className={styles.buildBtn}
            onClick={handleBuild}
            disabled={!canBuildAnything}
          >
            BUILD HERE
          </button>
        </div>
      </div>
    </div>
  );
}

function EconTile({ label, value, color }: { label: string; value: string; color: "cyan" | "lime" | "amber" | "red" }) {
  return (
    <div className={styles.econTile}>
      <span className={styles.econLabel}>{label}</span>
      <span className={[styles.econValue, styles[`econ-${color}`]].join(" ")}>{value}</span>
    </div>
  );
}
