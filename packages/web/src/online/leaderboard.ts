import {
  summarizeLeaderboardFromState,
  type GameState,
  type LeaderboardMetrics,
} from "@datacenter-tycoon/game-logic";
import { resolveOnlineApiBaseUrl } from "./config.js";

export interface LeaderboardRunSubmission {
  playerId: string;
  clientRunId: string;
  metrics: LeaderboardMetrics;
  gameMonth: number;
}

export interface LeaderboardSubmissionResult {
  created: boolean;
  run: {
    runId: string;
    playerId: string;
    clientRunId: string;
    metrics: LeaderboardMetrics;
    gameMonth: number;
    submittedAt: string;
    updatedAt: string;
  };
}

export type LeaderboardQueryMetric = keyof LeaderboardMetrics | "totalCapacity";
export type LeaderboardPeriod = "all-time";

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  username: string;
  metric: LeaderboardQueryMetric;
  value: number;
  submittedAt: string;
  gameMonth: number;
  metrics: LeaderboardMetrics;
}

export interface LeaderboardListResult {
  metric: LeaderboardQueryMetric;
  period: LeaderboardPeriod;
  limit: number;
  entries: LeaderboardEntry[];
}

export interface FetchLeaderboardOptions {
  metric?: LeaderboardQueryMetric;
  period?: LeaderboardPeriod;
  limit?: number;
}

export class LeaderboardSubmissionError extends Error {
  readonly code: string;
  readonly status: number | null;

  constructor(message: string, options: { code: string; status?: number | null }) {
    super(message);
    this.name = "LeaderboardSubmissionError";
    this.code = options.code;
    this.status = options.status ?? null;
  }
}

export function buildLeaderboardRunSubmission(
  playerId: string,
  state: GameState,
): LeaderboardRunSubmission {
  const summary = summarizeLeaderboardFromState(state);

  return {
    playerId,
    clientRunId: summary.gameId,
    metrics: summary.metrics,
    gameMonth: summary.gameMonth,
  };
}

export class LeaderboardQueryError extends Error {
  readonly code: string;
  readonly status: number | null;

  constructor(message: string, options: { code: string; status?: number | null }) {
    super(message);
    this.name = "LeaderboardQueryError";
    this.code = options.code;
    this.status = options.status ?? null;
  }
}

export async function fetchLeaderboard(
  options: FetchLeaderboardOptions = {},
  fetchImpl: typeof fetch = fetch,
): Promise<LeaderboardListResult> {
  const baseUrl = resolveOnlineApiBaseUrl();

  if (!baseUrl) {
    throw new LeaderboardQueryError(
      "Online leaderboard viewing is not configured for this build.",
      { code: "ONLINE_LEADERBOARD_DISABLED" },
    );
  }

  const url = new URL("/leaderboard", `${baseUrl}/`);
  url.searchParams.set("metric", options.metric ?? "money");
  url.searchParams.set("period", options.period ?? "all-time");
  url.searchParams.set("limit", String(options.limit ?? 10));

  let response: Response;

  try {
    response = await fetchImpl(url.toString());
  } catch (error) {
    throw new LeaderboardQueryError(
      error instanceof Error
        ? error.message
        : "Could not reach the online leaderboard service.",
      { code: "NETWORK_ERROR" },
    );
  }

  const payload = await readJsonBody(response);

  if (!response.ok) {
    const apiError = isApiErrorPayload(payload) ? payload.error : null;

    throw new LeaderboardQueryError(
      apiError?.message ?? `Leaderboard query failed with status ${response.status}.`,
      {
        code: apiError?.code ?? "QUERY_FAILED",
        status: response.status,
      },
    );
  }

  if (!isLeaderboardListResult(payload)) {
    throw new LeaderboardQueryError(
      "Leaderboard query returned an invalid response.",
      {
        code: "INVALID_RESPONSE",
        status: response.status,
      },
    );
  }

  return payload;
}

export async function submitLeaderboardRun(
  submission: LeaderboardRunSubmission,
  fetchImpl: typeof fetch = fetch,
): Promise<LeaderboardSubmissionResult> {
  const baseUrl = resolveOnlineApiBaseUrl();

  if (!baseUrl) {
    throw new LeaderboardSubmissionError(
      "Online leaderboard submission is not configured for this build.",
      { code: "ONLINE_LEADERBOARD_DISABLED" },
    );
  }

  let response: Response;

  try {
    response = await fetchImpl(new URL("/leaderboard/runs", `${baseUrl}/`).toString(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(submission),
    });
  } catch (error) {
    throw new LeaderboardSubmissionError(
      error instanceof Error
        ? error.message
        : "Could not reach the online leaderboard service.",
      { code: "NETWORK_ERROR" },
    );
  }

  const payload = await readJsonBody(response);

  if (!response.ok) {
    const apiError = isApiErrorPayload(payload) ? payload.error : null;

    throw new LeaderboardSubmissionError(
      apiError?.message
        ?? `Leaderboard submission failed with status ${response.status}.`,
      {
        code: apiError?.code ?? "SUBMISSION_FAILED",
        status: response.status,
      },
    );
  }

  if (!isLeaderboardSubmissionResult(payload)) {
    throw new LeaderboardSubmissionError(
      "Leaderboard submission returned an invalid response.",
      {
        code: "INVALID_RESPONSE",
        status: response.status,
      },
    );
  }

  return payload;
}

function isLeaderboardSubmissionResult(payload: unknown): payload is LeaderboardSubmissionResult {
  return Boolean(payload)
    && typeof payload === "object"
    && typeof (payload as { created?: unknown }).created === "boolean"
    && Boolean((payload as { run?: unknown }).run)
    && typeof (payload as { run?: { runId?: unknown } }).run?.runId === "string";
}

function isLeaderboardListResult(payload: unknown): payload is LeaderboardListResult {
  return Boolean(payload)
    && typeof payload === "object"
    && typeof (payload as { metric?: unknown }).metric === "string"
    && typeof (payload as { period?: unknown }).period === "string"
    && typeof (payload as { limit?: unknown }).limit === "number"
    && Array.isArray((payload as { entries?: unknown[] }).entries)
    && (payload as { entries: unknown[] }).entries.every(isLeaderboardEntry);
}

function isLeaderboardEntry(payload: unknown): payload is LeaderboardEntry {
  return Boolean(payload)
    && typeof payload === "object"
    && typeof (payload as { rank?: unknown }).rank === "number"
    && typeof (payload as { playerId?: unknown }).playerId === "string"
    && typeof (payload as { username?: unknown }).username === "string"
    && typeof (payload as { metric?: unknown }).metric === "string"
    && typeof (payload as { value?: unknown }).value === "number"
    && typeof (payload as { submittedAt?: unknown }).submittedAt === "string"
    && typeof (payload as { gameMonth?: unknown }).gameMonth === "number"
    && isLeaderboardMetrics((payload as { metrics?: unknown }).metrics);
}

function isLeaderboardMetrics(payload: unknown): payload is LeaderboardMetrics {
  return Boolean(payload)
    && typeof payload === "object"
    && typeof (payload as { money?: unknown }).money === "number"
    && typeof (payload as { cumulativeRevenue?: unknown }).cumulativeRevenue === "number"
    && typeof (payload as { totalServers?: unknown }).totalServers === "number"
    && typeof (payload as { computeCapacity?: unknown }).computeCapacity === "number"
    && typeof (payload as { memoryCapacity?: unknown }).memoryCapacity === "number"
    && typeof (payload as { storageCapacity?: unknown }).storageCapacity === "number"
    && typeof (payload as { gpuCapacity?: unknown }).gpuCapacity === "number";
}

function isApiErrorPayload(payload: unknown): payload is { error: { code: string; message: string } } {
  return Boolean(payload)
    && typeof payload === "object"
    && typeof (payload as { error?: { code?: unknown; message?: unknown } }).error?.code === "string"
    && typeof (payload as { error?: { code?: unknown; message?: unknown } }).error?.message === "string";
}

async function readJsonBody(response: Response): Promise<unknown> {
  const bodyText = await response.text();

  if (!bodyText) {
    return null;
  }

  try {
    return JSON.parse(bodyText) as unknown;
  } catch {
    return null;
  }
}
