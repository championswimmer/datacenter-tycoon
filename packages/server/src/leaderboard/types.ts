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

export interface LeaderboardRunSubmission {
  playerId: string;
  clientRunId: string;
  metrics: LeaderboardMetrics;
  gameMonth: number;
}

export interface LeaderboardRunRecord {
  runId: string;
  playerId: string;
  clientRunId: string;
  metrics: LeaderboardMetrics;
  gameMonth: number;
  submittedAt: Date;
  updatedAt: Date;
}

export interface CreateLeaderboardRunInput extends LeaderboardRunSubmission {
  runId: string;
  submittedAt?: Date;
  updatedAt?: Date;
}

export class LeaderboardValidationError extends Error {
  readonly code = "INVALID_LEADERBOARD_SUBMISSION";

  constructor(message: string) {
    super(message);
    this.name = "LeaderboardValidationError";
  }
}

export class LeaderboardPlayerNotFoundError extends Error {
  readonly code = "PLAYER_NOT_FOUND";

  constructor(message: string) {
    super(message);
    this.name = "LeaderboardPlayerNotFoundError";
  }
}

export class LeaderboardRunConflictError extends Error {
  readonly code = "CLIENT_RUN_CONFLICT";

  constructor(message: string) {
    super(message);
    this.name = "LeaderboardRunConflictError";
  }
}

export function generateLeaderboardRunId(): string {
  return `run_${crypto.randomUUID().replaceAll("-", "")}`;
}

export function createLeaderboardRunRecord(
  input: CreateLeaderboardRunInput,
): LeaderboardRunRecord {
  const submittedAt = input.submittedAt ?? new Date();
  const updatedAt = input.updatedAt ?? submittedAt;

  return {
    runId: input.runId,
    playerId: input.playerId,
    clientRunId: input.clientRunId,
    metrics: { ...input.metrics },
    gameMonth: input.gameMonth,
    submittedAt,
    updatedAt,
  };
}

export function leaderboardRunMatchesSubmission(
  run: LeaderboardRunRecord,
  submission: LeaderboardRunSubmission,
): boolean {
  return run.playerId === submission.playerId
    && run.clientRunId === submission.clientRunId
    && run.gameMonth === submission.gameMonth
    && LEADERBOARD_METRIC_KEYS.every((key) => run.metrics[key] === submission.metrics[key]);
}
