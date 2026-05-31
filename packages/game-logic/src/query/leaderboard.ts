import type { GameState } from "../types.js";
import { summarizeNetworkCapacityFromState } from "./datacenters.js";
import { selectCumulativeRevenueFromState } from "./finance.js";

export const LEADERBOARD_METRIC_KEYS = [
  "money",
  "cumulativeRevenue",
  "totalServers",
  "computeCapacity",
  "memoryCapacity",
  "storageCapacity",
  "gpuCapacity",
] as const;

export type LeaderboardMetricKey = (typeof LEADERBOARD_METRIC_KEYS)[number];

export interface LeaderboardMetrics {
  money: number;
  cumulativeRevenue: number;
  totalServers: number;
  computeCapacity: number;
  memoryCapacity: number;
  storageCapacity: number;
  gpuCapacity: number;
}

export interface LeaderboardStateSummary {
  gameId: GameState["gameId"];
  gameMonth: GameState["tick"];
  metrics: LeaderboardMetrics;
}

export function summarizeLeaderboardFromState(
  state: Pick<
    GameState,
    | "gameId"
    | "tick"
    | "player"
    | "ledger"
    | "financialHistory"
    | "datacenters"
    | "contracts"
    | "contractMarket"
    | "activeContracts"
  >,
): LeaderboardStateSummary {
  const network = summarizeNetworkCapacityFromState(state);

  return {
    gameId: state.gameId,
    gameMonth: state.tick,
    metrics: normalizeLeaderboardMetrics({
      money: state.player.cash,
      cumulativeRevenue: selectCumulativeRevenueFromState(state),
      totalServers: countInstalledServers(state),
      computeCapacity: network.installed.vCpu,
      memoryCapacity: network.installed.ramGb,
      storageCapacity: network.installed.storageTb,
      gpuCapacity: network.installed.gpuFlops,
    }),
  };
}

export function countInstalledServers(
  state: Pick<GameState, "datacenters">,
): number {
  return state.datacenters.reduce(
    (sum, datacenter) => sum + datacenter.placements.length,
    0,
  );
}

export function totalLeaderboardCapacity(metrics: LeaderboardMetrics): number {
  return metrics.computeCapacity
    + metrics.memoryCapacity
    + metrics.storageCapacity
    + metrics.gpuCapacity;
}

function normalizeLeaderboardMetrics(metrics: LeaderboardMetrics): LeaderboardMetrics {
  // The online leaderboard transport and persistence layers store integral values.
  // Cash and cumulative revenue can contain cents in live game state, so round here
  // before clients serialize the shared summary for submission.
  return {
    money: roundLeaderboardMetric(metrics.money),
    cumulativeRevenue: roundLeaderboardMetric(metrics.cumulativeRevenue),
    totalServers: roundLeaderboardMetric(metrics.totalServers),
    computeCapacity: roundLeaderboardMetric(metrics.computeCapacity),
    memoryCapacity: roundLeaderboardMetric(metrics.memoryCapacity),
    storageCapacity: roundLeaderboardMetric(metrics.storageCapacity),
    gpuCapacity: roundLeaderboardMetric(metrics.gpuCapacity),
  };
}

function roundLeaderboardMetric(value: number): number {
  return Math.round(value);
}
