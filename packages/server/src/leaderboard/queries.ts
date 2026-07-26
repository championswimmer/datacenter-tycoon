import { LEADERBOARD_METRIC_KEYS, totalLeaderboardCapacity } from "@datacenter-tycoon/game-logic";
import type { PlayersRepository } from "../players/repository.js";
import type { LeaderboardRepository } from "./repository.js";
import type { LeaderboardMetrics, LeaderboardRunRecord } from "./types.js";

export const LEADERBOARD_QUERY_METRICS = [
  ...LEADERBOARD_METRIC_KEYS,
  "totalCapacity",
] as const;

export type LeaderboardQueryMetric = (typeof LEADERBOARD_QUERY_METRICS)[number];
export type LeaderboardPeriod = "all-time";
export type LeaderboardVisibility = "verified" | "all";

export interface LeaderboardQuery {
  metric: LeaderboardQueryMetric;
  period: LeaderboardPeriod;
  limit: number;
  visibility: LeaderboardVisibility;
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  username: string;
  metric: LeaderboardQueryMetric;
  value: number;
  submittedAt: Date;
  gameMonth: number;
  metrics: LeaderboardMetrics;
}

export class LeaderboardQueryValidationError extends Error {
  readonly code = "INVALID_LEADERBOARD_QUERY";

  constructor(message: string) {
    super(message);
    this.name = "LeaderboardQueryValidationError";
  }
}

export function parseLeaderboardQuery(searchParams: URLSearchParams): LeaderboardQuery {
  const metric = searchParams.get("metric") ?? "money";
  const period = searchParams.get("period") ?? "all-time";
  const rawLimit = searchParams.get("limit") ?? "10";
  const visibility = searchParams.get("visibility") ?? "verified";

  if (!LEADERBOARD_QUERY_METRICS.includes(metric as LeaderboardQueryMetric)) {
    throw new LeaderboardQueryValidationError(`Unsupported leaderboard metric: ${metric}`);
  }

  if (period !== "all-time") {
    throw new LeaderboardQueryValidationError(`Unsupported leaderboard period: ${period}`);
  }

  const limit = Number(rawLimit);

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new LeaderboardQueryValidationError("limit must be an integer between 1 and 100.");
  }

  if (visibility !== "verified" && visibility !== "all") {
    throw new LeaderboardQueryValidationError(`Unsupported leaderboard visibility: ${visibility}`);
  }

  return {
    metric: metric as LeaderboardQueryMetric,
    period,
    limit,
    visibility,
  };
}

export async function queryLeaderboard(
  playersRepository: PlayersRepository,
  leaderboardRepository: LeaderboardRepository,
  query: LeaderboardQuery,
): Promise<LeaderboardEntry[]> {
  const runs = await leaderboardRepository.listRuns(query);
  const entries: LeaderboardEntry[] = [];

  for (const [index, run] of runs.entries()) {
    const player = await playersRepository.findByPlayerId(run.playerId);

    entries.push({
      rank: index + 1,
      playerId: run.playerId,
      username: player?.username ?? "Unknown Player",
      metric: query.metric,
      value: getMetricValue(run, query.metric),
      submittedAt: run.submittedAt,
      gameMonth: run.gameMonth,
      metrics: run.metrics,
    });
  }

  return entries;
}

export function getMetricValue(
  run: Pick<LeaderboardRunRecord, "metrics">,
  metric: LeaderboardQueryMetric,
): number {
  if (metric === "totalCapacity") {
    return totalLeaderboardCapacity(run.metrics);
  }

  return run.metrics[metric];
}
