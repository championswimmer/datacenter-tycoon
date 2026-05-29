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
