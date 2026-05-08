import {
  BASE_REPAIR_DAYS,
  RELIABILITY_BASELINE_SCORE,
  datacenterMaintenanceSummary,
  datacenterCapacity,
  datacenterUsage,
  rackAgeMonths,
  reliabilityBandForScore,
  reliabilityMarketPolicyForScore,
  repairProgressPerTick,
  tickOpex,
} from "@datacenter-tycoon/game-logic";
import type {
  Capacity,
  Contract,
  ContractSlaOutcome,
  DatacenterId,
  Datacenter,
  DatacenterResourceUsage,
  GameState,
  LedgerEntry,
  Money,
  OpexTickResult,
  RackHealthStatus,
  RackPlacementId,
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

  if (band === "trusted") {
    return {
      band,
      offerCount: policy.offerCount,
      offerDeltaFromBaseline,
      longTermBias: policy.longTermBias,
      shortTermBias: policy.shortTermBias,
      supplyLabel: `${policy.offerCount} market offers with extra premium access`,
      termLabel: "Longer anchor contracts appear more often.",
      summary: "Reliable fulfillment unlocks more offers and better long-term contract mix.",
    };
  }

  if (band === "at-risk") {
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

export interface RackMaintenanceView {
  placementId: RackPlacementId;
  ageMonths: number;
  status: RackHealthStatus;
  repairProgressDays: number;
  repairCompletionPercent: number;
  repairEtaTicks: number;
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

  return datacenter.placements.map((placement) => {
    const repairProgressDays = placement.repairProgressDays ?? 0;
    const remainingRepairDays = Math.max(0, BASE_REPAIR_DAYS - repairProgressDays);

    return {
      placementId: placement.id,
      ageMonths: rackAgeMonths(state.tick, placement),
      status: placement.health,
      repairProgressDays,
      repairCompletionPercent: Math.round((Math.min(repairProgressDays, BASE_REPAIR_DAYS) / BASE_REPAIR_DAYS) * 100),
      repairEtaTicks: placement.health === "repairing"
        ? Math.ceil(remainingRepairDays / repairProgressDaysPerTick)
        : 0,
    };
  });
}

/**
 * Contracts that are currently running (active or breached).
 * Does not include offered, completed, or cancelled.
 */
export function selectActiveContracts(state: GameState): Contract[] {
  return state.activeContracts.filter(
    (c) => c.status === "active" || c.status === "breached",
  );
}

/** All contracts currently on the open market (status === "offered"). */
export function selectMarket(state: GameState): Contract[] {
  return state.contractMarket;
}

/** Last N ledger entries, newest first. Defaults to all entries. */
export function selectLedger(state: GameState, limit = state.ledger.length): LedgerEntry[] {
  return state.ledger.slice(-limit).reverse();
}

// ── Derived / aggregate selectors ────────────────────────────────────────────

export interface AggregateCapacity {
  /** Sum of all racks across all datacenters */
  total: Capacity;
  /** Per-datacenter breakdown */
  perDc: Array<{ dcId: DatacenterId; capacity: Capacity }>;
}

/** Total and per-DC rack capacity (vCPU / RAM / Storage / GPU). */
export function selectCapacity(state: GameState): AggregateCapacity {
  const perDc = state.datacenters.map((dc) => ({
    dcId: dc.id,
    capacity: datacenterCapacity(dc),
  }));

  const total: Capacity = perDc.reduce(
    (acc, { capacity }) => ({
      vCpu: acc.vCpu + capacity.vCpu,
      ramGb: acc.ramGb + capacity.ramGb,
      storageTb: acc.storageTb + capacity.storageTb,
      gpuFlops: acc.gpuFlops + capacity.gpuFlops,
    }),
    { vCpu: 0, ramGb: 0, storageTb: 0, gpuFlops: 0 },
  );

  return { total, perDc };
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
  const perDc = state.datacenters.map((dc) => {
    const region = state.map.regions.find((r) => r.id === dc.regionId);
    // Fallback to a default region if not found (should not happen in normal gameplay)
    if (!region) {
      throw new Error(`Region not found for datacenter: ${dc.regionId}`);
    }
    return {
      dcId: dc.id,
      result: tickOpex(dc, region),
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
  const { total } = selectCapacity(state);

  const demand = selectActiveContracts(state).reduce<Capacity>(
    (acc, c) => ({
      vCpu: acc.vCpu + c.requirements.vCpu,
      ramGb: acc.ramGb + c.requirements.ramGb,
      storageTb: acc.storageTb + c.requirements.storageTb,
      gpuFlops: acc.gpuFlops + c.requirements.gpuFlops,
    }),
    { vCpu: 0, ramGb: 0, storageTb: 0, gpuFlops: 0 },
  );

  return {
    vCpu: Math.max(0, total.vCpu - demand.vCpu),
    ramGb: Math.max(0, total.ramGb - demand.ramGb),
    storageTb: Math.max(0, total.storageTb - demand.storageTb),
    gpuFlops: Math.max(0, total.gpuFlops - demand.gpuFlops),
  };
}

export function selectRegions(state: GameState): import("@datacenter-tycoon/game-logic").Region[] {
  return state.map.regions;
}

export function selectRegionById(
  state: GameState,
  regionId: string,
): import("@datacenter-tycoon/game-logic").Region | undefined {
  return state.map.regions.find((r) => r.id === regionId);
}

export function selectDatacentersByRegionId(state: GameState, regionId: string): Datacenter[] {
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
