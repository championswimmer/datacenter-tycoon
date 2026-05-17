import { useCallback, useMemo, useState } from "react";
import type {
  DatacenterId,
  DatacenterUpgradeTrackId,
  DatacenterUpgradeTrackLadderNodeView,
} from "@datacenter-tycoon/game-logic";
import { useGameDispatch, useSelector } from "../../store/storeContext.js";
import { selectCash, selectDatacenterInfrastructureSummary, selectDatacenterUpgradeSummary } from "../../store/selectors.js";
import { UpgradeConfirmationModal } from "./UpgradeConfirmationModal.js";
import styles from "./UpgradePanel.module.css";

const LADDER_STATUS_LABEL: Record<DatacenterUpgradeTrackLadderNodeView["status"], string> = {
  completed: "Complete",
  current: "Current",
  available: "Ready next",
  locked: "Locked",
};

function formatMoney(value: number): string {
  return `$${value.toLocaleString()}`;
}

function ladderNodeClassName(status: DatacenterUpgradeTrackLadderNodeView["status"]): string {
  return [
    styles.ladderNode,
    status === "completed" ? styles.ladderNodeCompleted : "",
    status === "current" ? styles.ladderNodeCurrent : "",
    status === "available" ? styles.ladderNodeAvailable : "",
    status === "locked" ? styles.ladderNodeLocked : "",
  ].filter(Boolean).join(" ");
}

interface UpgradePanelProps {
  dcId: DatacenterId;
}

export function UpgradePanel({ dcId }: UpgradePanelProps) {
  const cash = useSelector(selectCash);
  const infrastructure = useSelector((state) => selectDatacenterInfrastructureSummary(state, dcId));
  const upgrades = useSelector((state) => selectDatacenterUpgradeSummary(state, dcId));
  const dispatch = useGameDispatch();
  const [pendingTrackId, setPendingTrackId] = useState<DatacenterUpgradeTrackId | null>(null);

  const pendingTrack = useMemo(
    () => upgrades?.tracks.find((track) => track.trackId === pendingTrackId) ?? null,
    [pendingTrackId, upgrades],
  );

  const handleCloseModal = useCallback(() => {
    setPendingTrackId(null);
  }, []);

  const handleConfirmUpgrade = useCallback(() => {
    if (!pendingTrack?.nextNode || cash < pendingTrack.nextNode.capexCost) {
      return;
    }

    dispatch({
      type: "UpgradeDatacenter",
      dcId,
      trackId: pendingTrack.trackId,
      targetNodeId: pendingTrack.nextNode.id,
    });
    setPendingTrackId(null);
  }, [cash, dcId, dispatch, pendingTrack]);

  if (!infrastructure || !upgrades) {
    return null;
  }

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>UPGRADE TRACKS</h3>
          <p className={styles.copy}>
            Preview the full infrastructure ladder before committing capex. Fiber is required before this site can join a regional fabric pool.
          </p>
        </div>
        <div className={styles.flags}>
          <span className={styles.flag}>FABRIC {upgrades.fabricEligible ? "READY" : "LOCKED"}</span>
          <span className={styles.flag}>UPKEEP ${upgrades.fixedMonthlyUpgradeOpex.toLocaleString()}/mo</span>
        </div>
      </div>

      <div className={styles.infrastructureGrid}>
        <div className={styles.infrastructureCard}>
          <span className={styles.infrastructureLabel}>POWER ENVELOPE</span>
          <span className={styles.infrastructureValue}>
            {infrastructure.effective.rackPowerCapacityKw} kW
          </span>
          <span className={styles.infrastructureHint}>
            Base {infrastructure.base.gridImportCapacityKw} grid + {infrastructure.effective.onsiteGenerationCapacityKw} onsite
          </span>
        </div>
        <div className={styles.infrastructureCard}>
          <span className={styles.infrastructureLabel}>COOLING MODE</span>
          <span className={styles.infrastructureValue}>{infrastructure.effective.coolingType.toUpperCase()}</span>
          <span className={styles.infrastructureHint}>
            {Math.round(infrastructure.base.coolingCapacityBtuPerHr).toLocaleString()} → {Math.round(infrastructure.effective.coolingCapacityBtuPerHr).toLocaleString()} BTU/hr
          </span>
        </div>
        <div className={styles.infrastructureCard}>
          <span className={styles.infrastructureLabel}>NETWORK TYPE</span>
          <span className={styles.infrastructureValue}>{infrastructure.effective.networkType.toUpperCase()}</span>
          <span className={styles.infrastructureHint}>
            {infrastructure.base.bandwidthGbps} → {infrastructure.effective.bandwidthGbps} Gbps
          </span>
        </div>
      </div>

      <div className={styles.trackGrid}>
        {upgrades.tracks.map((track) => (
          <article key={track.trackId} className={styles.trackCard}>
            <div className={styles.trackHeader}>
              <div>
                <span className={styles.trackLabel}>{track.label}</span>
                <span className={styles.trackMeta}>
                  {track.currentNodeIndex + 1} / {track.totalNodes} {track.presentation === "slots" ? "installed" : "level"}
                </span>
              </div>
              <span className={styles.trackCurrent}>{track.currentNode.label}</span>
            </div>

            <div className={styles.trackBody}>
              <div className={styles.ladderSummary}>
                <span className={styles.trackStat}>Node ID: {track.currentNode.id}</span>
                <span className={styles.trackStat}>Upkeep: ${track.currentNode.fixedMonthlyOpex.toLocaleString()}/mo</span>
                <span className={styles.trackStat}>
                  Reach: {track.currentNodeIndex + 1} of {track.totalNodes} {track.presentation === "slots" ? "installs" : "levels"}
                </span>
              </div>

              <ol className={styles.ladder} aria-label={`${track.label} upgrade ladder`}>
                {track.nodes.map((node) => (
                  <li key={node.id} className={ladderNodeClassName(node.status)}>
                    <span className={styles.ladderStep}>{node.index + 1}</span>
                    <div className={styles.ladderCopy}>
                      <span className={styles.ladderName}>{node.label}</span>
                      <span className={styles.ladderMeta}>
                        {LADDER_STATUS_LABEL[node.status]} · ${node.capexCost.toLocaleString()} capex · ${node.fixedMonthlyOpex.toLocaleString()}/mo
                      </span>
                    </div>
                    <span className={styles.ladderBadge}>{LADDER_STATUS_LABEL[node.status]}</span>
                  </li>
                ))}
              </ol>

              {track.nextNode ? (
                <>
                  <span className={styles.trackNext}>NEXT · {track.nextNode.label}</span>
                  <span className={styles.trackStat}>Capex {formatMoney(track.nextNode.capexCost)}</span>
                  <span className={styles.trackStat}>Δ Opex +{formatMoney(track.nextNode.fixedMonthlyOpexDelta)}/mo</span>
                  {cash < track.nextNode.capexCost ? (
                    <span className={styles.trackWarning}>
                      Short {formatMoney(track.nextNode.capexCost - cash)}. This step costs {formatMoney(track.nextNode.capexCost)} upfront.
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className={styles.upgradeButton}
                    onClick={() => setPendingTrackId(track.trackId)}
                    disabled={cash < track.nextNode.capexCost}
                    title={
                      cash < track.nextNode.capexCost
                        ? `Short ${formatMoney(track.nextNode.capexCost - cash)} for ${track.nextNode.label}`
                        : `Review ${track.nextNode.label} upgrade for ${formatMoney(track.nextNode.capexCost)}`
                    }
                  >
                    {cash < track.nextNode.capexCost
                      ? `Short ${formatMoney(track.nextNode.capexCost - cash)} · ${track.nextNode.label}`
                      : `Review ${track.nextNode.label} · ${formatMoney(track.nextNode.capexCost)}`}
                  </button>
                </>
              ) : (
                <span className={styles.maxed}>MAXED</span>
              )}
            </div>
          </article>
        ))}
      </div>
      {pendingTrack?.nextNode ? (
        <UpgradeConfirmationModal
          track={pendingTrack}
          cash={cash}
          canAfford={cash >= pendingTrack.nextNode.capexCost}
          onClose={handleCloseModal}
          onConfirm={handleConfirmUpgrade}
        />
      ) : null}
    </section>
  );
}
