import {
  LEADERBOARD_METRIC_KEYS,
  type LeaderboardMetrics,
  type LeaderboardRunSubmission,
  LeaderboardValidationError,
} from "./types.js";

const CLIENT_RUN_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export function parseLeaderboardRunSubmission(payload: unknown): LeaderboardRunSubmission {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new LeaderboardValidationError("Leaderboard submission must be a JSON object.");
  }

  const record = payload as Record<string, unknown>;
  const playerId = parseRequiredString(record.playerId, "playerId");
  const clientRunId = parseClientRunId(record.clientRunId);
  const metrics = parseLeaderboardMetrics(record.metrics);
  const gameMonth = parseNonNegativeSafeInteger(record.gameMonth, "gameMonth");

  return {
    playerId,
    clientRunId,
    metrics,
    gameMonth,
  };
}

function parseRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new LeaderboardValidationError(`${fieldName} must be a string.`);
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new LeaderboardValidationError(`${fieldName} is required.`);
  }

  return trimmed;
}

function parseClientRunId(value: unknown): string {
  const clientRunId = parseRequiredString(value, "clientRunId");

  if (!CLIENT_RUN_ID_PATTERN.test(clientRunId)) {
    throw new LeaderboardValidationError(
      "clientRunId may only contain letters, numbers, periods, underscores, colons, and hyphens.",
    );
  }

  return clientRunId;
}

function parseLeaderboardMetrics(value: unknown): LeaderboardMetrics {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LeaderboardValidationError("metrics must be an object.");
  }

  const metricsRecord = value as Record<string, unknown>;
  const unknownKeys = Object.keys(metricsRecord).filter(
    (key) => !LEADERBOARD_METRIC_KEYS.includes(key as (typeof LEADERBOARD_METRIC_KEYS)[number]),
  );

  if (unknownKeys.length > 0) {
    throw new LeaderboardValidationError(
      `metrics contains unsupported keys: ${unknownKeys.join(", ")}`,
    );
  }

  return {
    money: parseNonNegativeSafeInteger(metricsRecord.money, "metrics.money"),
    cumulativeRevenue: parseNonNegativeSafeInteger(
      metricsRecord.cumulativeRevenue,
      "metrics.cumulativeRevenue",
    ),
    totalServers: parseNonNegativeSafeInteger(metricsRecord.totalServers, "metrics.totalServers"),
    computeCapacity: parseNonNegativeSafeInteger(
      metricsRecord.computeCapacity,
      "metrics.computeCapacity",
    ),
    memoryCapacity: parseNonNegativeSafeInteger(
      metricsRecord.memoryCapacity,
      "metrics.memoryCapacity",
    ),
    storageCapacity: parseNonNegativeSafeInteger(
      metricsRecord.storageCapacity,
      "metrics.storageCapacity",
    ),
    gpuCapacity: parseNonNegativeSafeInteger(metricsRecord.gpuCapacity, "metrics.gpuCapacity"),
  };
}

function parseNonNegativeSafeInteger(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new LeaderboardValidationError(`${fieldName} must be a safe integer.`);
  }

  if (value < 0) {
    throw new LeaderboardValidationError(`${fieldName} must be non-negative.`);
  }

  return value;
}
