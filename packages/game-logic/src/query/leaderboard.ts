import type { GameState, LedgerEntry, Money } from "../types.js";
import { summarizeNetworkCapacityFromState } from "./datacenters.js";

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
    metrics: {
      money: state.player.cash,
      cumulativeRevenue: summarizeCumulativeRevenue(state.ledger),
      totalServers: countInstalledServers(state),
      computeCapacity: network.installed.vCpu,
      memoryCapacity: network.installed.ramGb,
      storageCapacity: network.installed.storageTb,
      gpuCapacity: network.installed.gpuFlops,
    },
  };
}

export function summarizeCumulativeRevenue(
  ledger: readonly Pick<LedgerEntry, "type" | "amount">[],
): Money {
  return ledger
    .filter((entry) => entry.type === "revenue")
    .reduce((sum, entry) => sum + entry.amount, 0);
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
