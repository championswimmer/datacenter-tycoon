import {
  DAYS_PER_TICK,
  RELIABILITY_BASELINE_SCORE,
  contractDealScore,
  datacenterMaintenanceSummary,
  datacenterUsage,
  rackAgeMonths,
  reliabilityBandForScore,
  reliabilityMarketPolicyForScore,
  summarizeContractSlaProgress,
  bucketContractsFromState,
  summarizeDatacenterRackMaintenanceViewsFromState,
  repairProgressPerTick,
  listRackMoveTargets,
  selectDatacenterMaintenanceStaffingViewFromState,
  selectDatacenterRackActivityViewFromState,
  selectDatacenterRackPowerSummaryFromState,
  selectHistoricalContractsFromState,
  selectLiveContractsFromState,
  selectOpenMarketContractsFromState,
  summarizeDatacenterCapacityFromState,
  summarizeDatacenterFabricCapacityFromState,
  summarizeDatacenterFabricStatusFromState,
  summarizeDatacenterInfrastructureFromState,
  summarizeDatacenterUpgradeViewFromState,
  summarizeAllRegionFabricViewsFromState,
  summarizeNetworkCapacityFromState,
  summarizeContractRegionAffinity,
  summarizeOpenMarketContractFits,
  summarizeRegionFabricViewFromState,
  tickOpex,
} from "@datacenter-tycoon/game-logic";
import type {
  Capacity,
  Contract,
  ContractAssignmentFitSummary,
  ContractId,
  ContractRegionAffinityKey,
  ContractSlaOutcome,
  ContractSlaProgressView,
  DatacenterId,
  Datacenter,
  DatacenterRackMaintenanceStatusView,
  DatacenterResourceUsage,
  Difficulty,
  GameState,
  GameTimeView,
  LedgerEntry,
  Money,
  OpexTickResult,
  Subtick,
  DatacenterCapacityFromStateSummary,
  DatacenterFabricStatusView,
  DatacenterInfrastructureView,
  DatacenterMaintenanceStaffingView,
  DatacenterUpgradeView,
  FabricCapacitySummary,
  MoveRackTarget,
  RackActivityView,
  RackHealthStatus,
  RackPlacementId,
  RackPowerSummary,
  Region,
  RegionFabricView,
  RegionId,
  ReliabilityBand,
  Tick,
  AudioSettings,
} from "@datacenter-tycoon/game-logic";

function haveSameInputs(nextInputs: readonly unknown[], prevInputs: readonly unknown[]): boolean {
  return nextInputs.length === prevInputs.length
    && nextInputs.every((input, index) => Object.is(input, prevInputs[index]));
}

function memoizeByInputs<Args extends unknown[], Result>(
  getInputs: (...args: Args) => readonly unknown[],
  compute: (...args: Args) => Result,
): (...args: Args) => Result {
  let hasResult = false;
  let lastInputs: readonly unknown[] = [];
  let lastResult!: Result;

  return (...args: Args): Result => {
    const nextInputs = getInputs(...args);
    if (hasResult && haveSameInputs(nextInputs, lastInputs)) {
      return lastResult;
    }

    lastResult = compute(...args);
    lastInputs = nextInputs;
    hasResult = true;
    return lastResult;
  };
}

const selectDatacenterIndex = memoizeByInputs(
  (state: Pick<GameState, "datacenters">) => [state.datacenters],
  (state) => new Map(state.datacenters.map((datacenter) => [datacenter.id, datacenter] as const)),
);

const selectRegionIndex = memoizeByInputs(
  (state: Pick<GameState, "map">) => [state.map.regions],
  (state) => new Map(state.map.regions.map((region) => [region.id, region] as const)),
);

const selectRegionLabelIndex = memoizeByInputs(
  (state: Pick<GameState, "map">) => [state.map.regions],
  (state) => new Map(
    state.map.regions.map((region) => [region.id, `${region.code} · ${region.city} · ${region.name}`] as const),
  ),
);

const selectDatacentersByRegionIndex = memoizeByInputs(
  (state: Pick<GameState, "datacenters">) => [state.datacenters],
  (state) => {
    const grouped = new Map<RegionId, Datacenter[]>();
    for (const datacenter of state.datacenters) {
      const group = grouped.get(datacenter.regionId);
      if (group) {
        group.push(datacenter);
      } else {
        grouped.set(datacenter.regionId, [datacenter]);
      }
    }
    return grouped;
  },
);

const selectContractBuckets = memoizeByInputs(
  (state: Pick<GameState, "contracts" | "contractMarket" | "activeContracts">) => [
    state.contracts,
    state.contractMarket,
    state.activeContracts,
  ],
  (state) => bucketContractsFromState(state),
);

const selectMemoizedMarketFitSummaries = memoizeByInputs(
  (state: GameState) => [state.contracts, state.contractMarket, state.activeContracts, state.datacenters, state.map.regions],
  (state) => summarizeOpenMarketContractFits(state),
);

const selectMemoizedMarketContractViews = memoizeByInputs(
  (state: GameState) => [state.contracts, state.contractMarket, state.activeContracts, state.datacenters, state.map.regions],
  (state) => {
    const marketContracts = selectMarket(state);
    const fitSummaries = selectMemoizedMarketFitSummaries(state);
    const fitSummaryById = new Map(fitSummaries.map((summary) => [summary.contractId, summary] as const));
    const datacentersById = selectDatacenterIndex(state);

    return marketContracts.map((contract) => {
      const fitSummary = fitSummaryById.get(contract.id) ?? summarizeOpenMarketContractFits({
        ...state,
        contracts: [contract],
        contractMarket: [contract],
        activeContracts: [],
      })[0]!;
      const candidateByDcId = new Map(fitSummary.candidates.map((candidate) => [candidate.dcId, candidate] as const));

      return {
        contract,
        affinity: buildContractAffinityView(state, contract),
        fitSummary,
        eligibleDatacenterIds: [...fitSummary.eligibleDcIds],
        assignmentOptions: state.datacenters.map((datacenter) =>
          buildAssignmentOptionView(
            state,
            datacenter,
            candidateByDcId.get(datacenter.id),
          )
        ),
        slaProgress: summarizeContractSlaProgress(contract),
        dealScore: contractDealScore(contract),
        networkAvailable: fitSummary.networkAvailable,
        assignedDatacenter: contract.assignedDcId ? datacentersById.get(contract.assignedDcId) ?? null : null,
      };
    });
  },
);

const selectMemoizedAssignedContractViews = memoizeByInputs(
  (state: GameState, contracts: Contract[]) => [contracts, state.datacenters, state.map.regions],
  (state, contracts) => {
    const datacentersById = selectDatacenterIndex(state);

    return contracts.map((contract) => {
      const assignedDc = contract.assignedDcId ? datacentersById.get(contract.assignedDcId) : undefined;
      return {
        contract,
        affinity: buildContractAffinityView(state, contract),
        assignedDcName: assignedDc?.name ?? null,
        assignedRegionLabel: assignedDc ? formatRegionLabel(state, assignedDc.regionId) : null,
        slaProgress: summarizeContractSlaProgress(contract),
      };
    });
  },
);

const selectMemoizedAllRegionFabricSummaries = memoizeByInputs(
  (state: GameState) => [state.datacenters, state.map.regions],
  (state) => summarizeAllRegionFabricViewsFromState(state),
);

const selectMemoizedAllDatacenterFabricSummaries = memoizeByInputs(
  (state: GameState) => [state.datacenters, state.map.regions],
  (state) => selectMemoizedAllRegionFabricSummaries(state).flatMap((regionSummary) =>
    regionSummary.datacenters.map((summary) => ({
      dcId: summary.dcId,
      summary,
    })),
  ),
);

const selectMemoizedCapacity = memoizeByInputs(
  (state: GameState) => [state.datacenters, state.activeContracts],
  (state): AggregateCapacity => {
    const summary = selectNetworkCapacitySummary(state);
    return {
      total: summary.installed,
      perDc: summary.perDc.map((entry) => ({
        dcId: entry.dcId,
        capacity: entry.installed,
      })),
    };
  },
);

const selectMemoizedOpexBreakdown = memoizeByInputs(
  (state: GameState) => [state.datacenters, state.map.regions, state.contracts, state.contractMarket, state.activeContracts],
  (state): AggregateOpex => {
    const activeContracts = selectActiveContracts(state);
    const regionsById = selectRegionIndex(state);

    const perDc = state.datacenters.map((dc) => {
      const region = regionsById.get(dc.regionId);
      if (!region) {
        throw new Error(`Region not found for datacenter: ${dc.regionId}`);
      }
      return {
        dcId: dc.id,
        result: tickOpex(dc, region, activeContracts),
      };
    });

    const total = Math.round(
      perDc.reduce((sum, { result }) => sum + result.total, 0) * 100,
    ) / 100;

    return { total, perDc };
  },
);

const selectMemoizedRackPowerSummary = memoizeByInputs(
  (state: GameState) => [state.datacenters, state.contracts, state.contractMarket, state.activeContracts],
  (state): AggregateRackPowerSummary => {
    const perDc = state.datacenters.map((dc) => ({
      dcId: dc.id,
      summary: selectDatacenterRackPowerSummaryFromState(state, dc.id),
    }));

    const total = perDc.reduce<RackPowerSummary>(
      (acc, { summary }) => ({
        reservedPowerKw: acc.reservedPowerKw + summary.reservedPowerKw,
        idleBaselinePowerKw: acc.idleBaselinePowerKw + summary.idleBaselinePowerKw,
        activePowerKw: acc.activePowerKw + summary.activePowerKw,
        billedPowerKw: acc.billedPowerKw + summary.billedPowerKw,
        activeRackCount: acc.activeRackCount + summary.activeRackCount,
        idleRackCount: acc.idleRackCount + summary.idleRackCount,
        repairingRackCount: acc.repairingRackCount + summary.repairingRackCount,
        totalRackCount: acc.totalRackCount + summary.totalRackCount,
      }),
      {
        reservedPowerKw: 0,
        idleBaselinePowerKw: 0,
        activePowerKw: 0,
        billedPowerKw: 0,
        activeRackCount: 0,
        idleRackCount: 0,
        repairingRackCount: 0,
        totalRackCount: 0,
      },
    );

    return { total, perDc };
  },
);

const selectMemoizedResourceUsage = memoizeByInputs(
  (state: GameState) => [state.datacenters],
  (state): AggregateResourceUsage => {
    const perDc = state.datacenters.map((dc) => ({
      dcId: dc.id,
      usage: datacenterUsage(dc),
    }));

    const total: DatacenterResourceUsage = perDc.reduce(
      (acc, { usage }) => ({
        powerKw: acc.powerKw + usage.powerKw,
        heatOutputBtuPerHr: acc.heatOutputBtuPerHr + usage.heatOutputBtuPerHr,
        bandwidthGbps: acc.bandwidthGbps + usage.bandwidthGbps,
        slotsUsed: acc.slotsUsed + usage.slotsUsed,
      }),
      { powerKw: 0, heatOutputBtuPerHr: 0, bandwidthGbps: 0, slotsUsed: 0 },
    );

    return { total, perDc };
  },
);

// ── Primitive selectors ───────────────────────────────────────────────────────

export function selectTick(state: GameState): Tick {
  return state.tick;
}

export function selectSubtick(state: GameState): Subtick {
  return state.subtick;
}

export function selectGameTimeView(state: GameState): GameTimeView {
  return {
    tick: state.tick,
    subtick: state.subtick,
    dayOfMonth: state.subtick + 1,
    monthFraction: state.subtick / DAYS_PER_TICK,
  };
}

export function selectAnimatedGameTimeView(state: GameState, fraction = 0): GameTimeView {
  const monthFraction = Math.min(0.999999, (state.subtick + Math.min(Math.max(fraction, 0), 0.999999)) / DAYS_PER_TICK);
  return {
    tick: state.tick,
    subtick: state.subtick,
    dayOfMonth: state.subtick + 1,
    monthFraction,
  };
}

export function selectCash(state: GameState): Money {
  return state.player.cash;
}

export function selectDifficulty(state: GameState): Difficulty {
  return state.difficulty;
}

export function selectPlayerName(state: GameState): string {
  return state.player.name;
}

export function selectReliabilityScore(state: GameState): number {
  return state.player.reliability.score;
}

export function selectReliabilityBand(state: GameState): ReliabilityBand {
  return reliabilityBandForScore(state.player.reliability.score);
}

export function selectReliabilityDelta(state: GameState): number {
  return state.player.reliability.lastDelta ?? 0;
}

export function selectRecentSlaOutcomes(state: GameState): ContractSlaOutcome[] {
  return state.player.reliability.recentOutcomes;
}

export interface ReliabilitySummary {
  score: number;
  band: ReliabilityBand;
  lastDelta: number;
  trend: "up" | "down" | "steady";
  recentOutcomes: ContractSlaOutcome[];
}

export interface ReliabilityMarketEffectSummary {
  band: ReliabilityBand;
  offerCount: number;
  offerDeltaFromBaseline: number;
  longTermBias: number;
  shortTermBias: number;
  supplyLabel: string;
  termLabel: string;
  summary: string;
}

export function selectReliabilitySummary(state: GameState): ReliabilitySummary {
  const score = selectReliabilityScore(state);
  const lastDelta = selectReliabilityDelta(state);

  return {
    score,
    band: selectReliabilityBand(state),
    lastDelta,
    trend: lastDelta > 0 ? "up" : lastDelta < 0 ? "down" : "steady",
    recentOutcomes: selectRecentSlaOutcomes(state),
  };
}

export function selectReliabilityMarketEffectSummary(
  state: GameState,
): ReliabilityMarketEffectSummary {
  const band = selectReliabilityBand(state);
  const policy = reliabilityMarketPolicyForScore(selectReliabilityScore(state));
  const baselineOfferCount = reliabilityMarketPolicyForScore(RELIABILITY_BASELINE_SCORE).offerCount;
  const offerDeltaFromBaseline = policy.offerCount - baselineOfferCount;

  if (band === "diamond") {
    return {
      band,
      offerCount: policy.offerCount,
      offerDeltaFromBaseline,
      longTermBias: policy.longTermBias,
      shortTermBias: policy.shortTermBias,
      supplyLabel: `${policy.offerCount} market offers with Diamond-tier premium access`,
      termLabel: "Extended anchor contracts dominate your market mix.",
      summary: "Diamond status unlocks the widest market and the best long-term opportunities.",
    };
  }

  if (band === "platinum") {
    return {
      band,
      offerCount: policy.offerCount,
      offerDeltaFromBaseline,
      longTermBias: policy.longTermBias,
      shortTermBias: policy.shortTermBias,
      supplyLabel: `${policy.offerCount} market offers with Platinum-tier access`,
      termLabel: "Longer anchor contracts appear more often.",
      summary: "Reliable fulfillment unlocks more offers and a better long-term contract mix.",
    };
  }

  if (band === "silver") {
    return {
      band,
      offerCount: policy.offerCount,
      offerDeltaFromBaseline,
      longTermBias: policy.longTermBias,
      shortTermBias: policy.shortTermBias,
      supplyLabel: `${policy.offerCount} market offers while reputation recovers`,
      termLabel: "Shorter rush work is more common until SLA performance improves.",
      summary: "Breaches shrink the market and make longer-term deals harder to earn.",
    };
  }

  if (band === "bronze") {
    return {
      band,
      offerCount: policy.offerCount,
      offerDeltaFromBaseline,
      longTermBias: policy.longTermBias,
      shortTermBias: policy.shortTermBias,
      supplyLabel: `${policy.offerCount} market offers with Bronze-tier restricted access`,
      termLabel: "Only short-term rush contracts are available at this reputation level.",
      summary: "Severe reputation damage has heavily restricted your contract market.",
    };
  }

  return {
    band,
    offerCount: policy.offerCount,
    offerDeltaFromBaseline,
    longTermBias: policy.longTermBias,
    shortTermBias: policy.shortTermBias,
    supplyLabel: `${policy.offerCount} standard market offers`,
    termLabel: "Balanced mix of short and long-term work.",
    summary: "Fulfilled contracts improve future opportunities; breaches reduce them.",
  };
}

export function selectAllDatacenters(state: GameState): Datacenter[] {
  return state.datacenters;
}

/** Total number of racks across all datacenters. */
export function selectTotalRacks(state: GameState): number {
  return state.datacenters.reduce((acc, dc) => acc + dc.placements.length, 0);
}

/** Total number of servers (racks) across all datacenters. */
export function selectTotalServers(state: GameState): number {
  return selectTotalRacks(state);
}

export function selectDatacenter(
  state: GameState,
  id: DatacenterId,
): Datacenter | undefined {
  return selectDatacenterIndex(state).get(id);
}

export interface DatacenterMaintenanceView {
  dcId: DatacenterId;
  maintenanceStaff: number;
  totalRackCount: number;
  healthyRackCount: number;
  repairingRackCount: number;
  averageRackAgeMonths: number;
  hasRepairingRacks: boolean;
}

export function selectDatacenterMaintenanceView(
  state: GameState,
  id: DatacenterId,
): DatacenterMaintenanceView | undefined {
  const datacenter = selectDatacenter(state, id);
  if (!datacenter) {
    return undefined;
  }

  const summary = datacenterMaintenanceSummary(datacenter, state.tick);
  return {
    dcId: datacenter.id,
    maintenanceStaff: datacenter.maintenanceStaff,
    totalRackCount: summary.totalRackCount,
    healthyRackCount: summary.healthyRackCount,
    repairingRackCount: summary.repairingRackCount,
    averageRackAgeMonths: summary.averageRackAgeMonths,
    hasRepairingRacks: summary.repairingRackCount > 0,
  };
}

export function selectMaintenanceViews(state: GameState): DatacenterMaintenanceView[] {
  return state.datacenters
    .map((dc) => selectDatacenterMaintenanceView(state, dc.id))
    .filter((view): view is DatacenterMaintenanceView => view !== undefined);
}

export function selectDatacenterMaintenanceStaffingView(
  state: GameState,
  id: DatacenterId,
): DatacenterMaintenanceStaffingView | undefined {
  const datacenter = selectDatacenter(state, id);
  if (!datacenter) {
    return undefined;
  }

  return selectDatacenterMaintenanceStaffingViewFromState(state, id);
}

export type RackMaintenanceView = DatacenterRackMaintenanceStatusView;

export function selectDatacenterRackMaintenanceViews(
  state: GameState,
  id: DatacenterId,
): RackMaintenanceView[] {
  const datacenter = selectDatacenter(state, id);
  if (!datacenter) {
    return [];
  }

  return summarizeDatacenterRackMaintenanceViewsFromState(state, id);
}

/**
 * Contracts that are currently live (serving or breached).
 * Does not include market-open or historical contracts.
 */
export function selectActiveContracts(state: GameState): Contract[] {
  return selectContractBuckets(state).live;
}

export function selectHistoricalContracts(state: GameState): Contract[] {
  return selectContractBuckets(state).historical;
}

export function selectDatacenterRackActivityViews(
  state: GameState,
  id: DatacenterId,
): RackActivityView[] {
  const datacenter = selectDatacenter(state, id);
  if (!datacenter) {
    return [];
  }

  return selectDatacenterRackActivityViewFromState(state, id);
}

export function selectDatacenterRackPowerSummary(
  state: GameState,
  id: DatacenterId,
): RackPowerSummary | undefined {
  const datacenter = selectDatacenter(state, id);
  if (!datacenter) {
    return undefined;
  }

  return selectDatacenterRackPowerSummaryFromState(state, id);
}

/** All contracts currently on the open market. */
export function selectMarket(state: GameState): Contract[] {
  return selectContractBuckets(state).market;
}

export function selectMarketFitSummaries(state: GameState): ContractAssignmentFitSummary[] {
  return selectMemoizedMarketFitSummaries(state);
}

const CONTRACT_AFFINITY_BADGE_LABELS: Record<ContractRegionAffinityKey, string> = {
  eu: "EU ONLY",
  asia: "ASIA ONLY",
  usa: "USA ONLY",
};

export interface ContractAffinityView {
  restricted: boolean;
  key: ContractRegionAffinityKey | null;
  badgeLabel: string;
  allowedRegionIds: RegionId[];
  allowedRegions: string[];
  summary: string;
}

export interface ContractAssignmentOptionView {
  dcId: DatacenterId;
  dcName: string;
  regionId: RegionId;
  regionLabel: string;
  regionEligible: boolean;
  fitsCapacity: boolean;
  fits: boolean;
  disabledReason: "wrong_region" | "insufficient_capacity" | null;
  disabledMessage: string | null;
}

export interface MarketContractView {
  contract: Contract;
  affinity: ContractAffinityView;
  fitSummary: ContractAssignmentFitSummary;
  eligibleDatacenterIds: DatacenterId[];
  assignmentOptions: ContractAssignmentOptionView[];
  slaProgress: ContractSlaProgressView;
  dealScore: number;
  networkAvailable: Capacity;
  assignedDatacenter: Datacenter | null;
}

export interface AssignedContractView {
  contract: Contract;
  affinity: ContractAffinityView;
  assignedDcName: string | null;
  assignedRegionLabel: string | null;
  slaProgress: ContractSlaProgressView;
}

function formatRegionLabel(state: Pick<GameState, "map">, regionId: RegionId): string {
  return selectRegionLabelIndex(state).get(regionId) ?? regionId;
}

function buildContractAffinityView(
  state: Pick<GameState, "map">,
  contract: Pick<Contract, "regionAffinity">,
): ContractAffinityView {
  const summary = summarizeContractRegionAffinity(contract, state.map.regions);
  const allowedRegions = summary.allowedRegionIds.map((regionId) => formatRegionLabel(state, regionId));

  if (!summary.restricted) {
    return {
      restricted: false,
      key: null,
      badgeLabel: "ANY REGION",
      allowedRegionIds: summary.allowedRegionIds,
      allowedRegions,
      summary: "Any region",
    };
  }

  return {
    restricted: true,
    key: summary.key,
    badgeLabel: CONTRACT_AFFINITY_BADGE_LABELS[summary.key!],
    allowedRegionIds: summary.allowedRegionIds,
    allowedRegions,
    summary: `${CONTRACT_AFFINITY_BADGE_LABELS[summary.key!]} · ${allowedRegions.join(", ")}`,
  };
}

function buildAssignmentOptionView(
  state: Pick<GameState, "map">,
  datacenter: Pick<Datacenter, "id" | "name" | "regionId">,
  candidate: ContractAssignmentFitSummary["candidates"][number] | undefined,
): ContractAssignmentOptionView {
  const regionLabel = formatRegionLabel(state, datacenter.regionId);
  const regionEligible = candidate?.regionEligible ?? true;
  const fitsCapacity = candidate?.fitsCapacity ?? false;
  const fits = candidate?.fits ?? false;
  const disabledReason = fits
    ? null
    : regionEligible
      ? "insufficient_capacity"
      : "wrong_region";

  return {
    dcId: datacenter.id,
    dcName: datacenter.name,
    regionId: datacenter.regionId,
    regionLabel,
    regionEligible,
    fitsCapacity,
    fits,
    disabledReason,
    disabledMessage: disabledReason === null
      ? null
      : disabledReason === "wrong_region"
        ? `${regionLabel} is outside this contract's allowed regions.`
        : `Not enough local capacity in ${datacenter.name}.`,
  };
}

export function selectContractAffinityView(
  state: Pick<GameState, "map">,
  contract: Pick<Contract, "regionAffinity">,
): ContractAffinityView {
  return buildContractAffinityView(state, contract);
}

export function selectMarketContractViews(state: GameState): MarketContractView[] {
  return selectMemoizedMarketContractViews(state);
}

export function selectAssignedContractViews(
  state: GameState,
  contracts: Contract[],
): AssignedContractView[] {
  return selectMemoizedAssignedContractViews(state, contracts);
}

export function selectActiveContractViews(state: GameState): AssignedContractView[] {
  return selectAssignedContractViews(state, selectActiveContracts(state));
}

export function selectHistoricalContractViews(state: GameState): AssignedContractView[] {
  return selectAssignedContractViews(state, selectHistoricalContracts(state));
}

export function selectRackMoveTargets(
  state: GameState,
  sourceDcId: DatacenterId,
  placementId: RackPlacementId,
): MoveRackTarget[] {
  return listRackMoveTargets(state, sourceDcId, placementId);
}

/** Last N ledger entries, newest first. Defaults to all entries. */
export function selectLedger(state: GameState, limit = state.ledger.length): LedgerEntry[] {
  return state.ledger.slice(-limit).reverse();
}

// ── Derived / aggregate selectors ────────────────────────────────────────────

export interface AggregateCapacity {
  /** Sum of all installed racks across all datacenters */
  total: Capacity;
  /** Per-datacenter installed capacity breakdown */
  perDc: Array<{ dcId: DatacenterId; capacity: Capacity }>;
}

export function selectNetworkCapacitySummary(state: GameState) {
  return summarizeNetworkCapacityFromState(state);
}

export function selectDatacenterCapacitySummary(
  state: GameState,
  id: DatacenterId,
): DatacenterCapacityFromStateSummary | undefined {
  const datacenter = selectDatacenter(state, id);
  if (!datacenter) {
    return undefined;
  }

  return summarizeDatacenterCapacityFromState(state, id);
}

export function selectDatacenterInfrastructureSummary(
  state: GameState,
  id: DatacenterId,
): DatacenterInfrastructureView | undefined {
  const datacenter = selectDatacenter(state, id);
  if (!datacenter) {
    return undefined;
  }

  return summarizeDatacenterInfrastructureFromState(state, id);
}

export function selectDatacenterUpgradeSummary(
  state: GameState,
  id: DatacenterId,
): DatacenterUpgradeView | undefined {
  const datacenter = selectDatacenter(state, id);
  if (!datacenter) {
    return undefined;
  }

  return summarizeDatacenterUpgradeViewFromState(state, id);
}

export function selectDatacenterFabricCapacitySummary(
  state: GameState,
  id: DatacenterId,
): FabricCapacitySummary | undefined {
  const datacenter = selectDatacenter(state, id);
  if (!datacenter) {
    return undefined;
  }

  return summarizeDatacenterFabricCapacityFromState(state, id);
}

export function selectDatacenterFabricSummary(
  state: GameState,
  id: DatacenterId,
): DatacenterFabricStatusView | undefined {
  const datacenter = selectDatacenter(state, id);
  if (!datacenter) {
    return undefined;
  }

  return summarizeDatacenterFabricStatusFromState(state, id);
}

export function selectRegionFabricSummary(
  state: GameState,
  regionId: RegionId,
): RegionFabricView | undefined {
  const region = selectRegionById(state, regionId);
  if (!region) {
    return undefined;
  }

  return summarizeRegionFabricViewFromState(state, region.id);
}

export function selectAllRegionFabricSummaries(state: GameState): RegionFabricView[] {
  return selectMemoizedAllRegionFabricSummaries(state);
}

export function selectAllDatacenterFabricSummaries(
  state: GameState,
): Array<{ dcId: DatacenterId; summary: DatacenterFabricStatusView }> {
  return selectMemoizedAllDatacenterFabricSummaries(state);
}

/** Total installed and per-DC installed capacity (vCPU / RAM / Storage / GPU). */
export function selectCapacity(state: GameState): AggregateCapacity {
  return selectMemoizedCapacity(state);
}

export interface AggregateOpex {
  /** Sum of all DC opex totals */
  total: Money;
  /** Per-DC opex result (breakdown + total) */
  perDc: Array<{ dcId: DatacenterId; result: OpexTickResult }>;
}

/**
 * Monthly opex across all datacenters, broken down per DC.
 * Uses `tickOpex` from game-logic — never recomputes economy here.
 */
export function selectOpexBreakdown(state: GameState): AggregateOpex {
  return selectMemoizedOpexBreakdown(state);
}

export interface AggregateResourceUsage {
  /** Sum of all DC resource usage */
  total: DatacenterResourceUsage;
  /** Per-datacenter usage */
  perDc: Array<{ dcId: DatacenterId; usage: DatacenterResourceUsage }>;
}

export interface AggregateRackPowerSummary {
  total: RackPowerSummary;
  perDc: Array<{ dcId: DatacenterId; summary: RackPowerSummary }>;
}

/**
 * Reserved-vs-billed rack power derived from game-logic activity allocation.
 * Reserved power reflects placement headroom usage, billed power reflects this month's active workload.
 */
export function selectRackPowerSummary(state: GameState): AggregateRackPowerSummary {
  return selectMemoizedRackPowerSummary(state);
}

/** Real-time resource usage (power, cooling, bandwidth, slots). */
export function selectResourceUsage(state: GameState): AggregateResourceUsage {
  return selectMemoizedResourceUsage(state);
}

export interface MonthlyPnl {
  revenue: Money;
  opex: Money;
  net: Money;
}

/**
 * Estimate of last month's P&L from the most recent ledger entries.
 * Returns zeros if no ticks have fired yet (tick === 0).
 */
export function selectMonthlyPnl(state: GameState): MonthlyPnl {
  // Find the most recent tick's ledger entries (they share the same tick value)
  const lastTickWithEntries = state.ledger.length > 0
    ? state.ledger[state.ledger.length - 1]!.tick
    : -1;

  if (lastTickWithEntries < 0) {
    return { revenue: 0, opex: 0, net: 0 };
  }

  const lastEntries = state.ledger.filter((e) => e.tick === lastTickWithEntries);

  const revenue = lastEntries
    .filter((e) => e.type === "revenue")
    .reduce((sum, e) => sum + e.amount, 0);

  const opexRaw = lastEntries
    .filter((e) => e.type === "opex")
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);

  const penalty = lastEntries
    .filter((e) => e.type === "penalty")
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);

  const opex = Math.round((opexRaw + penalty) * 100) / 100;
  const net = Math.round((revenue - opex) * 100) / 100;

  return { revenue, opex, net };
}

/**
 * Free (unallocated) capacity: total rack capacity minus what active contracts require.
 * Values are floored at 0 — the contracts panel can show "over-committed" separately.
 */
export function selectFreeCapacity(state: GameState): Capacity {
  return selectNetworkCapacitySummary(state).available;
}

export function selectRegions(state: GameState): import("@datacenter-tycoon/game-logic").Region[] {
  return state.map.regions;
}

export function selectRegionById(
  state: GameState,
  regionId: RegionId,
): Region | undefined {
  return selectRegionIndex(state).get(regionId);
}

export function selectDatacentersByRegionId(state: GameState, regionId: RegionId): Datacenter[] {
  return selectDatacentersByRegionIndex(state).get(regionId) ?? [];
}

export function selectAudioEnabled(state: GameState): boolean {
  return state.audioEnabled ?? true;
}

export function selectAudioSettings(state: GameState): AudioSettings {
  return state.audioSettings ?? {
    master: state.audioEnabled ?? true,
    music: true,
    sfx: true,
    money: true,
    ambient: true,
  };
}
