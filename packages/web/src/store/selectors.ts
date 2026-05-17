import {
  RELIABILITY_BASELINE_SCORE,
  datacenterMaintenanceSummary,
  datacenterUsage,
  rackAgeMonths,
  rackFailureRiskView,
  reliabilityBandForScore,
  reliabilityMarketPolicyForScore,
  repairDurationDays,
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
  summarizeOpenMarketContractFits,
  summarizeRegionFabricViewFromState,
  tickOpex,
} from "@datacenter-tycoon/game-logic";
import type {
  Capacity,
  Contract,
  ContractAssignmentFitSummary,
  ContractSlaOutcome,
  DatacenterId,
  Datacenter,
  DatacenterResourceUsage,
  Difficulty,
  GameState,
  LedgerEntry,
  Money,
  OpexTickResult,
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
  RegionFabricView,
  RegionId,
  ReliabilityBand,
  Tick,
} from "@datacenter-tycoon/game-logic";

// ── Primitive selectors ───────────────────────────────────────────────────────

export function selectTick(state: GameState): Tick {
  return state.tick;
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
  return state.datacenters.find((dc) => dc.id === id);
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

export interface RackMaintenanceView {
  placementId: RackPlacementId;
  ageMonths: number;
  status: RackHealthStatus;
  repairProgressDays: number;
  repairCompletionPercent: number;
  repairEtaTicks: number;
  /**
   * Monthly failure probability in [0, 1], derived from `rackFailureRiskView()`.
   * Always 0 for racks that are currently `repairing`.
   */
  failureProbability: number;
}

export function selectDatacenterRackMaintenanceViews(
  state: GameState,
  id: DatacenterId,
): RackMaintenanceView[] {
  const datacenter = selectDatacenter(state, id);
  if (!datacenter) {
    return [];
  }

  const repairProgressDaysPerTick = repairProgressPerTick(datacenter.maintenanceStaff);
  const repairTargetDays = repairDurationDays(state.difficulty);

  return datacenter.placements.map((placement) => {
    const repairProgressDays = placement.repairProgressDays ?? 0;
    const remainingRepairDays = Math.max(0, repairTargetDays - repairProgressDays);
    const riskView = rackFailureRiskView(state.tick, placement, state.difficulty);

    return {
      placementId: placement.id,
      ageMonths: riskView.ageMonths,
      status: placement.health,
      repairProgressDays,
      repairCompletionPercent: Math.round((Math.min(repairProgressDays, repairTargetDays) / repairTargetDays) * 100),
      repairEtaTicks: placement.health === "repairing"
        ? Math.ceil(remainingRepairDays / repairProgressDaysPerTick)
        : 0,
      failureProbability: riskView.failureProbability,
    };
  });
}

/**
 * Contracts that are currently live (serving or breached).
 * Does not include market-open or historical contracts.
 */
export function selectActiveContracts(state: GameState): Contract[] {
  return selectLiveContractsFromState(state);
}

export function selectHistoricalContracts(state: GameState): Contract[] {
  return selectHistoricalContractsFromState(state);
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
  return selectOpenMarketContractsFromState(state);
}

export function selectMarketFitSummaries(state: GameState): ContractAssignmentFitSummary[] {
  return summarizeOpenMarketContractFits(state);
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
  return summarizeAllRegionFabricViewsFromState(state);
}

export function selectAllDatacenterFabricSummaries(
  state: GameState,
): Array<{ dcId: DatacenterId; summary: DatacenterFabricStatusView }> {
  return selectAllRegionFabricSummaries(state).flatMap((regionSummary) =>
    regionSummary.datacenters.map((summary) => ({
      dcId: summary.dcId,
      summary,
    })),
  );
}

/** Total installed and per-DC installed capacity (vCPU / RAM / Storage / GPU). */
export function selectCapacity(state: GameState): AggregateCapacity {
  const summary = selectNetworkCapacitySummary(state);
  return {
    total: summary.installed,
    perDc: summary.perDc.map((entry) => ({
      dcId: entry.dcId,
      capacity: entry.installed,
    })),
  };
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
  const activeContracts = selectActiveContracts(state);

  const perDc = state.datacenters.map((dc) => {
    const region = state.map.regions.find((r) => r.id === dc.regionId);
    // Fallback to a default region if not found (should not happen in normal gameplay)
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
}

/** Real-time resource usage (power, cooling, bandwidth, slots). */
export function selectResourceUsage(state: GameState): AggregateResourceUsage {
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
): import("@datacenter-tycoon/game-logic").Region | undefined {
  return state.map.regions.find((r) => r.id === regionId);
}

export function selectDatacentersByRegionId(state: GameState, regionId: RegionId): Datacenter[] {
  return state.datacenters.filter((dc) => dc.regionId === regionId);
}

export function selectAudioEnabled(state: GameState): boolean {
  return state.audioEnabled ?? true;
}

export function selectAudioSettings(state: GameState): import("@datacenter-tycoon/game-logic").AudioSettings {
  return state.audioSettings ?? {
    master: state.audioEnabled ?? true,
    music: true,
    sfx: true,
    money: true,
    ambient: true,
  };
}
