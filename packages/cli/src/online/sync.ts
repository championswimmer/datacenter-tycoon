import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { GameState } from "@datacenter-tycoon/game-logic";

import type { ParsedArgv } from "../argv.js";
import {
  getStringFlag,
  type CommandClient,
  type CommandPaths,
} from "../commands/common.js";
import {
  buildLeaderboardRunSubmission,
  submitLeaderboardRun,
  type LeaderboardRunSubmission,
  type LeaderboardSubmissionResult,
} from "./leaderboard.js";
import {
  readOnlineProfile,
  resolveOnlineTarget,
  type CliOnlineProfile,
  type ResolvedOnlineTarget,
} from "./profile.js";

const ONLINE_SYNC_STATE_FILE = "online-sync-state.json";

interface CliOnlineSyncState {
  signaturesByRunKey: Record<string, string>;
}

export type CliOnlineSyncStatus = "submitted" | "warning" | "skipped";
export type CliOnlineSyncSkipReason =
  | "not_logged_in"
  | "disabled"
  | "not_progressed"
  | "duplicate_signature";

export interface CliOnlineSyncResult {
  status: CliOnlineSyncStatus;
  message: string;
  reason?: CliOnlineSyncSkipReason;
  profile: CliOnlineProfile | null;
  target: ResolvedOnlineTarget;
  profilePath: string;
  syncStatePath: string;
  submission?: LeaderboardRunSubmission;
  response?: LeaderboardSubmissionResult;
}

export interface CliOnlineSyncDependencies {
  env?: NodeJS.ProcessEnv;
  readProfile?: typeof readOnlineProfile;
  readSyncState?: (syncStatePath: string) => Promise<CliOnlineSyncState>;
  writeSyncState?: (syncStatePath: string, state: CliOnlineSyncState) => Promise<void>;
  submitRun?: typeof submitLeaderboardRun;
  fetchImpl?: typeof fetch;
}

export function getOnlineSyncStatePath(paths: Pick<CommandPaths, "configDir">): string {
  return join(paths.configDir, ONLINE_SYNC_STATE_FILE);
}

export async function syncLeaderboardFromCommand(
  parsed: ParsedArgv,
  client: Pick<CommandClient, "query">,
  paths: Pick<CommandPaths, "configDir" | "onlineProfilePath">,
  dependencies: CliOnlineSyncDependencies = {},
): Promise<CliOnlineSyncResult> {
  const resolved = resolveSyncDependencies(dependencies);
  const syncStatePath = getOnlineSyncStatePath(paths);

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
        syncStatePath,
        null,
        target,
      );
    }

    if (!target.serverUrl) {
      return createSkippedResult(
        "disabled",
        "Online sync skipped because no server URL is configured.",
        paths.onlineProfilePath,
        syncStatePath,
        profile,
        target,
      );
    }

    const snapshot = (await client.query({ kind: "snapshot" })) as GameState;
    const submission = buildLeaderboardRunSubmission(profile.playerId, snapshot);

    if (submission.gameMonth <= 0) {
      return createSkippedResult(
        "not_progressed",
        "Online sync skipped because the run has not progressed beyond the opening month yet.",
        paths.onlineProfilePath,
        syncStatePath,
        profile,
        target,
        submission,
      );
    }

    const signature = JSON.stringify(submission);
    const syncState = await resolved.readSyncState(syncStatePath);
    const runKey = getSyncRunKey(profile, submission);

    if (syncState.signaturesByRunKey[runKey] === signature) {
      return createSkippedResult(
        "duplicate_signature",
        "Online sync skipped because this leaderboard payload was already submitted.",
        paths.onlineProfilePath,
        syncStatePath,
        profile,
        target,
        submission,
      );
    }

    const response = await resolved.submitRun(
      {
        serverUrl: target.serverUrl,
        submission,
      },
      resolved.fetchImpl,
    );

    await resolved.writeSyncState(syncStatePath, {
      signaturesByRunKey: {
        ...syncState.signaturesByRunKey,
        [runKey]: signature,
      },
    });

    return {
      status: "submitted",
      message: response.created
        ? `Submitted leaderboard run ${response.run.runId}.`
        : `Updated leaderboard run ${response.run.runId}.`,
      profile,
      target,
      profilePath: paths.onlineProfilePath,
      syncStatePath,
      submission,
      response,
    };
  } catch (error) {
    return {
      status: "warning",
      message: error instanceof Error ? error.message : String(error),
      profile: null,
      target: {
        serverUrl: null,
        source: "disabled",
      },
      profilePath: paths.onlineProfilePath,
      syncStatePath,
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

export async function readOnlineSyncState(syncStatePath: string): Promise<CliOnlineSyncState> {
  try {
    const rawState = await readFile(syncStatePath, "utf8");
    const parsedState = JSON.parse(rawState) as unknown;
    return parseOnlineSyncState(parsedState);
  } catch {
    return {
      signaturesByRunKey: {},
    };
  }
}

export async function writeOnlineSyncState(syncStatePath: string, state: CliOnlineSyncState): Promise<void> {
  const normalizedState = parseOnlineSyncState(state);
  await mkdir(dirname(syncStatePath), { recursive: true });
  await writeFile(syncStatePath, `${JSON.stringify(normalizedState, null, 2)}\n`, "utf8");
}

function resolveSyncDependencies(
  dependencies: CliOnlineSyncDependencies,
): Required<CliOnlineSyncDependencies> {
  return {
    env: dependencies.env ?? process.env,
    readProfile: dependencies.readProfile ?? readOnlineProfile,
    readSyncState: dependencies.readSyncState ?? readOnlineSyncState,
    writeSyncState: dependencies.writeSyncState ?? writeOnlineSyncState,
    submitRun: dependencies.submitRun ?? submitLeaderboardRun,
    fetchImpl: dependencies.fetchImpl ?? fetch,
  };
}

function createSkippedResult(
  reason: CliOnlineSyncSkipReason,
  message: string,
  profilePath: string,
  syncStatePath: string,
  profile: CliOnlineProfile | null,
  target: ResolvedOnlineTarget,
  submission?: LeaderboardRunSubmission,
): CliOnlineSyncResult {
  return {
    status: "skipped",
    reason,
    message,
    profile,
    target,
    profilePath,
    syncStatePath,
    submission,
  };
}

function getSyncRunKey(profile: CliOnlineProfile, submission: LeaderboardRunSubmission): string {
  return `${profile.playerId}:${submission.clientRunId}`;
}

function parseOnlineSyncState(payload: unknown): CliOnlineSyncState {
  if (!payload || typeof payload !== "object") {
    return { signaturesByRunKey: {} };
  }

  const signaturesByRunKey = (payload as { signaturesByRunKey?: unknown }).signaturesByRunKey;
  if (!signaturesByRunKey || typeof signaturesByRunKey !== "object") {
    return { signaturesByRunKey: {} };
  }

  return {
    signaturesByRunKey: Object.fromEntries(
      Object.entries(signaturesByRunKey).filter(
        (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string",
      ),
    ),
  };
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
