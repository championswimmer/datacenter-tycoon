import { createHash } from "node:crypto";
import {
  createVerifiedGenesisState,
  replayLeaderboardVerificationActions,
  summarizeLeaderboardFromState,
} from "@datacenter-tycoon/game-logic";
import type { ServerConfig } from "../config.js";
import type { RegisteredPlayer } from "../players/identity.js";
import type { LeaderboardRepository } from "./repository.js";
import {
  createLeaderboardRunRecord,
  LeaderboardReplayRejectedError,
  LeaderboardRulesetUnsupportedError,
  LeaderboardStaleRunHeadError,
  LeaderboardTickGapExceededError,
  LeaderboardUnknownRunHeadError,
  LeaderboardValidationError,
  type VerifiedLeaderboardRunHeadRecord,
  type VerifiedRunCheckpointSubmission,
  type VerifiedRunCommitResult,
} from "./types.js";

export interface VerifiedCheckpointResponse {
  created: boolean;
  rootHash: string;
  headHash: string;
  gameMonth: number;
  metrics: ReturnType<typeof summarizeLeaderboardFromState>["metrics"];
}

export async function submitVerifiedCheckpoint(
  repository: LeaderboardRepository,
  player: RegisteredPlayer,
  submission: VerifiedRunCheckpointSubmission,
  config: Pick<ServerConfig, "leaderboardVerification">,
): Promise<VerifiedCheckpointResponse> {
  if (submission.actions.length > config.leaderboardVerification.maxActionCount) {
    throw new LeaderboardValidationError(
      `actions may contain at most ${config.leaderboardVerification.maxActionCount} entries.`,
    );
  }

  const existingHead = await repository.findRunHead(submission.playerId, submission.clientRunId);
  const requestHash = sha256Canonical({
    parentHeadHash: submission.parentHeadHash,
    actions: submission.actions,
  });

  if (existingHead) {
    if (
      existingHead.previousHeadHash === submission.parentHeadHash
      && existingHead.lastRequestHash === requestHash
    ) {
      const summary = summarizeLeaderboardFromState(existingHead.authoritativeState);
      return {
        created: false,
        rootHash: existingHead.rootHash,
        headHash: existingHead.headHash,
        gameMonth: summary.gameMonth,
        metrics: summary.metrics,
      };
    }

    if (submission.genesis) {
      throw new LeaderboardValidationError(
        "genesis must be omitted after the server has accepted a verified run head.",
      );
    }

    if (submission.parentHeadHash !== existingHead.headHash) {
      throw new LeaderboardStaleRunHeadError(
        `Run ${submission.clientRunId} expected parent ${existingHead.headHash}, received ${submission.parentHeadHash}.`,
      );
    }

    return commitReplay(
      repository,
      player,
      submission,
      config,
      existingHead,
      requestHash,
    );
  }

  if (!submission.genesis) {
    throw new LeaderboardUnknownRunHeadError(
      `Run ${submission.clientRunId} has no accepted verified head yet; genesis is required.`,
    );
  }

  if (submission.parentHeadHash !== null) {
    throw new LeaderboardUnknownRunHeadError(
      `Run ${submission.clientRunId} cannot continue from unknown parent ${submission.parentHeadHash}.`,
    );
  }

  if (submission.genesis.rulesetId !== config.leaderboardVerification.rulesetId) {
    throw new LeaderboardRulesetUnsupportedError(
      `Unsupported verified-run ruleset: ${submission.genesis.rulesetId}.`,
    );
  }

  return commitReplay(repository, player, submission, config, null, requestHash);
}

async function commitReplay(
  repository: LeaderboardRepository,
  player: RegisteredPlayer,
  submission: VerifiedRunCheckpointSubmission,
  config: Pick<ServerConfig, "leaderboardVerification">,
  existingHead: VerifiedLeaderboardRunHeadRecord | null,
  requestHash: string,
): Promise<VerifiedCheckpointResponse> {
  const genesisDescriptor = existingHead?.genesisDescriptor ?? {
    seed: submission.genesis!.seed,
    difficulty: submission.genesis!.difficulty,
    gameId: submission.clientRunId as VerifiedLeaderboardRunHeadRecord["genesisDescriptor"]["gameId"],
    playerName: player.username,
  };
  const initialState = existingHead?.authoritativeState ?? createVerifiedGenesisState(genesisDescriptor);
  const previousTick = initialState.tick;
  const rootHash = existingHead?.rootHash ?? sha256Canonical({
    protocolVersion: config.leaderboardVerification.protocolVersion,
    rulesetId: config.leaderboardVerification.rulesetId,
    genesisDescriptor,
    genesisState: initialState,
  });

  let replayed;
  try {
    replayed = replayLeaderboardVerificationActions(initialState, submission.actions);
  } catch (error) {
    throw new LeaderboardReplayRejectedError(
      error instanceof Error ? error.message : "Verified run replay failed.",
    );
  }

  const tickDelta = replayed.state.tick - previousTick;

  if (tickDelta > config.leaderboardVerification.maxTickDelta) {
    throw new LeaderboardTickGapExceededError(
      `Verified replay advanced ${tickDelta} completed month(s), exceeding the limit of ${config.leaderboardVerification.maxTickDelta}.`,
    );
  }

  const stateHash = sha256Canonical(replayed.state);
  const headHash = sha256Canonical({
    rootHash,
    parentHeadHash: submission.parentHeadHash,
    requestHash,
    stateHash,
  });

  let committed: VerifiedRunCommitResult;
  try {
    committed = await repository.commitVerifiedRun({
      expectedParentHeadHash: submission.parentHeadHash,
      run: createLeaderboardRunRecord({
        runId: existingHead ? "placeholder" : "placeholder",
        playerId: submission.playerId,
        clientRunId: submission.clientRunId,
        verificationStatus: "verified",
        metrics: replayed.summary.metrics,
        gameMonth: replayed.summary.gameMonth,
        updatedAt: new Date(),
      }),
      head: {
        playerId: submission.playerId,
        clientRunId: submission.clientRunId,
        protocolVersion: config.leaderboardVerification.protocolVersion,
        rulesetId: config.leaderboardVerification.rulesetId,
        genesisDescriptor,
        rootHash,
        headHash,
        stateHash,
        previousHeadHash: submission.parentHeadHash,
        lastRequestHash: requestHash,
        authoritativeState: replayed.state,
        gameMonth: replayed.summary.gameMonth,
      },
    });
  } catch (error) {
    if (error instanceof LeaderboardStaleRunHeadError) {
      const currentHead = await repository.findRunHead(submission.playerId, submission.clientRunId);

      if (
        currentHead
        && currentHead.previousHeadHash === submission.parentHeadHash
        && currentHead.lastRequestHash === requestHash
      ) {
        const summary = summarizeLeaderboardFromState(currentHead.authoritativeState);
        return {
          created: false,
          rootHash: currentHead.rootHash,
          headHash: currentHead.headHash,
          gameMonth: summary.gameMonth,
          metrics: summary.metrics,
        };
      }
    }

    throw error;
  }

  return {
    created: committed.created,
    rootHash: committed.head.rootHash,
    headHash: committed.head.headHash,
    gameMonth: committed.run.gameMonth,
    metrics: committed.run.metrics,
  };
}

export function sha256Canonical(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalizeCanonicalValue(value));
}

function normalizeCanonicalValue(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Canonical JSON cannot encode non-finite numbers.");
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeCanonicalValue(entry));
  }

  if (!value || typeof value !== "object") {
    throw new Error(`Canonical JSON cannot encode values of type ${typeof value}.`);
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  return Object.fromEntries(
    entries.map(([key, entryValue]) => [key, normalizeCanonicalValue(entryValue)]),
  );
}
