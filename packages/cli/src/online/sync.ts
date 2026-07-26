import type { GameState } from "@datacenter-tycoon/game-logic";

import type { ParsedArgv } from "../argv.js";
import {
  getStringFlag,
  type CommandClient,
  type CommandPaths,
} from "../commands/common.js";
import {
  submitLeaderboardRun,
  type LeaderboardSubmissionResult,
} from "./leaderboard.js";
import {
  acknowledgeVerifiedCheckpoint,
  buildVerifiedCheckpointSubmission,
  getLastEligibleGameMonth,
  getPendingTickDelta,
  markVerifiedRunSyncFailure,
  type CliVerifiedRunState,
  type VerifiedRunCheckpointSubmission,
} from "./verified-run.js";
import {
  readOnlineProfile,
  resolveOnlineTarget,
  type CliOnlineProfile,
  type ResolvedOnlineTarget,
} from "./profile.js";

export type CliOnlineSyncStatus = "submitted" | "warning" | "skipped";
export type CliOnlineSyncSkipReason =
  | "not_logged_in"
  | "disabled"
  | "not_progressed"
  | "already_verified"
  | "local_only";

export interface CliOnlineSyncResult {
  status: CliOnlineSyncStatus;
  message: string;
  reason?: CliOnlineSyncSkipReason;
  profile: CliOnlineProfile | null;
  target: ResolvedOnlineTarget;
  profilePath: string;
  submission?: VerifiedRunCheckpointSubmission;
  response?: LeaderboardSubmissionResult;
  verification?: CliVerifiedRunState;
}

export interface CliOnlineSyncDependencies {
  env?: NodeJS.ProcessEnv;
  readProfile?: typeof readOnlineProfile;
  submitRun?: typeof submitLeaderboardRun;
  fetchImpl?: typeof fetch;
}

export async function syncLeaderboardFromCommand(
  parsed: ParsedArgv,
  client: Pick<CommandClient, "query" | "control">,
  paths: Pick<CommandPaths, "onlineProfilePath">,
  dependencies: CliOnlineSyncDependencies = {},
): Promise<CliOnlineSyncResult> {
  const resolved = resolveSyncDependencies(dependencies);

  try {
    const profile = await resolved.readProfile(paths.onlineProfilePath);
    const target = resolveOnlineTarget({
      flagServerUrl: getStringFlag(parsed, "--server"),
      profile,
      env: resolved.env,
    });

    if (!profile) {
      return createSkippedResult(
        "not_logged_in",
        "Online sync skipped because no CLI online profile is configured.",
        paths.onlineProfilePath,
        null,
        target,
      );
    }

    if (!target.serverUrl) {
      return createSkippedResult(
        "disabled",
        "Online sync skipped because no server URL is configured.",
        paths.onlineProfilePath,
        profile,
        target,
      );
    }

    const snapshot = (await client.query({ kind: "snapshot" })) as GameState;
    const verification = (await client.query({ kind: "verification" })) as CliVerifiedRunState;

    if (snapshot.tick <= 0 && verification.pendingActions.length === 0) {
      return createSkippedResult(
        "not_progressed",
        "Online sync skipped because the run has not progressed beyond the opening month yet.",
        paths.onlineProfilePath,
        profile,
        target,
        undefined,
        verification,
      );
    }

    if (verification.status === "local-only") {
      return createSkippedResult(
        "local_only",
        "Online sync skipped because this run is already local-only and no longer eligible for verified leaderboard submission.",
        paths.onlineProfilePath,
        profile,
        target,
        undefined,
        verification,
      );
    }

    const submission = buildVerifiedCheckpointSubmission(profile.playerId, verification);

    if (!submission) {
      return createSkippedResult(
        "already_verified",
        "Online sync skipped because there are no pending verified actions to submit.",
        paths.onlineProfilePath,
        profile,
        target,
        undefined,
        verification,
      );
    }

    const response = await resolved.submitRun(
      {
        serverUrl: target.serverUrl,
        submission,
      },
      resolved.fetchImpl,
    );

    const nextVerification = acknowledgeVerifiedCheckpoint(verification, response);
    await client.control({ op: "set-verification", verification: nextVerification });

    return {
      status: "submitted",
      message: response.created
        ? `Submitted verified leaderboard checkpoint ${response.headHash.slice(0, 12)}.`
        : `Advanced verified leaderboard checkpoint ${response.headHash.slice(0, 12)}.`,
      profile,
      target,
      profilePath: paths.onlineProfilePath,
      submission,
      response,
      verification: nextVerification,
    };
  } catch (error) {
    const verification = await readVerificationBestEffort(client);
    const snapshot = await readSnapshotBestEffort(client);
    const nextVerification = verification && snapshot
      ? markVerifiedRunSyncFailure(
          verification,
          error instanceof Error && "code" in error ? String((error as { code?: unknown }).code ?? "") || null : null,
          snapshot,
        )
      : verification;
    const lastEligibleMonth = nextVerification && snapshot
      ? getLastEligibleGameMonth(nextVerification)
      : null;
    const pendingTicks = nextVerification && snapshot
      ? getPendingTickDelta(nextVerification, snapshot)
      : null;

    if (nextVerification) {
      await client.control({ op: "set-verification", verification: nextVerification });
    }

    return {
      status: "warning",
      message: nextVerification && lastEligibleMonth !== null && pendingTicks !== null
        ? `${error instanceof Error ? error.message : String(error)} (month ${pendingTicks} pending; reconnect before month ${lastEligibleMonth})`
        : error instanceof Error ? error.message : String(error),
      profile: null,
      target: {
        serverUrl: null,
        source: "disabled",
      },
      profilePath: paths.onlineProfilePath,
      verification: nextVerification ?? undefined,
    };
  }
}

export function appendOnlineSyncToCommandResult<TData>(
  text: string,
  data: TData,
  sync: CliOnlineSyncResult,
  options: { includeSkipped?: boolean } = {},
): { text: string; data: TData | { result: TData; onlineSync: CliOnlineSyncResult } } {
  const note = formatOnlineSyncNote(sync, options);
  return {
    text: note ? `${text}\n${note}` : text,
    data: attachOnlineSyncData(data, sync, options),
  };
}

export function formatOnlineSyncNote(
  sync: CliOnlineSyncResult,
  options: { includeSkipped?: boolean } = {},
): string | null {
  if (sync.status === "submitted") {
    return `Online sync: ${sync.message}`;
  }

  if (sync.status === "warning") {
    return `Online sync warning: ${sync.message}`;
  }

  if (options.includeSkipped) {
    return `Online sync: ${sync.message}`;
  }

  return null;
}

function resolveSyncDependencies(
  dependencies: CliOnlineSyncDependencies,
): Required<CliOnlineSyncDependencies> {
  return {
    env: dependencies.env ?? process.env,
    readProfile: dependencies.readProfile ?? readOnlineProfile,
    submitRun: dependencies.submitRun ?? submitLeaderboardRun,
    fetchImpl: dependencies.fetchImpl ?? fetch,
  };
}

function createSkippedResult(
  reason: CliOnlineSyncSkipReason,
  message: string,
  profilePath: string,
  profile: CliOnlineProfile | null,
  target: ResolvedOnlineTarget,
  submission?: VerifiedRunCheckpointSubmission,
  verification?: CliVerifiedRunState,
): CliOnlineSyncResult {
  return {
    status: "skipped",
    reason,
    message,
    profile,
    target,
    profilePath,
    submission,
    verification,
  };
}

async function readVerificationBestEffort(
  client: Pick<CommandClient, "query" | "control">,
): Promise<CliVerifiedRunState | null> {
  try {
    return (await client.query({ kind: "verification" })) as CliVerifiedRunState;
  } catch {
    return null;
  }
}

async function readSnapshotBestEffort(
  client: Pick<CommandClient, "query" | "control">,
): Promise<GameState | null> {
  try {
    return (await client.query({ kind: "snapshot" })) as GameState;
  } catch {
    return null;
  }
}

function attachOnlineSyncData<TData>(
  data: TData,
  sync: CliOnlineSyncResult,
  options: { includeSkipped?: boolean },
): TData | { result: TData; onlineSync: CliOnlineSyncResult } {
  if (sync.status === "skipped" && !options.includeSkipped) {
    return data;
  }

  if (data !== null && typeof data === "object" && !Array.isArray(data)) {
    return {
      ...(data as Record<string, unknown>),
      onlineSync: sync,
    } as TData;
  }

  return {
    result: data,
    onlineSync: sync,
  };
}
