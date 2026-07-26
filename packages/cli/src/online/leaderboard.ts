import { normalizeServerUrl } from "./profile.js";
import type {
  VerifiedRunCheckpointResponse as LeaderboardSubmissionResult,
  VerifiedRunCheckpointSubmission as LeaderboardRunSubmission,
} from "./verified-run.js";
export type { LeaderboardSubmissionResult, LeaderboardRunSubmission };

export interface SubmitLeaderboardRunOptions {
  serverUrl: string | null;
  submission: LeaderboardRunSubmission;
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

export async function submitLeaderboardRun(
  options: SubmitLeaderboardRunOptions,
  fetchImpl: typeof fetch = fetch,
): Promise<LeaderboardSubmissionResult> {
  const baseUrl = normalizeOptionalServerUrl(options.serverUrl);

  if (!baseUrl) {
    throw new LeaderboardSubmissionError(
      "Online sync is disabled because no server URL is configured.",
      { code: "ONLINE_SYNC_DISABLED" },
    );
  }

  let response: Response;

  try {
    response = await fetchImpl(new URL("/leaderboard/runs", `${baseUrl}/`).toString(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(options.submission),
    });
  } catch (error) {
    throw new LeaderboardSubmissionError(
      error instanceof Error ? error.message : "Could not reach the online leaderboard service.",
      { code: "NETWORK_ERROR" },
    );
  }

  const payload = await readJsonBody(response);

  if (!response.ok) {
    const apiError = isApiErrorPayload(payload) ? payload.error : null;

    throw new LeaderboardSubmissionError(
      apiError?.message ?? `Leaderboard submission failed with status ${response.status}.`,
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

export function isSubmissionUnavailableError(error: unknown): boolean {
  if (!(error instanceof LeaderboardSubmissionError)) {
    return false;
  }

  if (
    error.code === "INVALID_VERIFIED_RUN"
    || error.code === "PLAYER_NOT_FOUND"
    || error.code === "UNKNOWN_RUN_HEAD"
    || error.code === "STALE_RUN_HEAD"
    || error.code === "RUN_RULESET_UNSUPPORTED"
    || error.code === "RUN_TICK_GAP_EXCEEDED"
    || error.code === "RUN_REPLAY_REJECTED"
    || error.code === "INVALID_JSON"
  ) {
    return false;
  }

  return error.status === null || error.status >= 500;
}

function normalizeOptionalServerUrl(serverUrl: string | null | undefined): string | null {
  if (!serverUrl) {
    return null;
  }

  const normalized = normalizeServerUrl(serverUrl);
  return normalized.length > 0 ? normalized : null;
}

function isLeaderboardSubmissionResult(payload: unknown): payload is LeaderboardSubmissionResult {
  return Boolean(payload)
    && typeof payload === "object"
    && typeof (payload as { created?: unknown }).created === "boolean"
    && typeof (payload as { rootHash?: unknown }).rootHash === "string"
    && typeof (payload as { headHash?: unknown }).headHash === "string"
    && typeof (payload as { gameMonth?: unknown }).gameMonth === "number";
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
