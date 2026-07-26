import type {
  Difficulty,
  GameState,
  LeaderboardMetrics,
  VerifiedGameGenesisDescriptor,
  LeaderboardVerificationAction,
} from "@datacenter-tycoon/game-logic";
import { LEADERBOARD_METRIC_KEYS } from "@datacenter-tycoon/game-logic";

export type { LeaderboardMetricKey, LeaderboardMetrics } from "@datacenter-tycoon/game-logic";
export { LEADERBOARD_METRIC_KEYS } from "@datacenter-tycoon/game-logic";

export type LeaderboardVerificationStatus = "unverified" | "verified";

export interface VerifiedRunCheckpointGenesis {
  seed: number;
  difficulty: Difficulty;
  rulesetId: string;
}

export interface VerifiedRunCheckpointSubmission {
  playerId: string;
  clientRunId: string;
  genesis?: VerifiedRunCheckpointGenesis;
  parentHeadHash: string | null;
  actions: readonly LeaderboardVerificationAction[];
}

export interface LeaderboardRunRecord {
  runId: string;
  playerId: string;
  clientRunId: string;
  verificationStatus: LeaderboardVerificationStatus;
  metrics: LeaderboardMetrics;
  gameMonth: number;
  submittedAt: Date;
  updatedAt: Date;
}

export interface CreateLeaderboardRunInput {
  runId: string;
  playerId: string;
  clientRunId: string;
  verificationStatus: LeaderboardVerificationStatus;
  metrics: LeaderboardMetrics;
  gameMonth: number;
  submittedAt?: Date;
  updatedAt?: Date;
}

export interface VerifiedLeaderboardRunHeadRecord {
  playerId: string;
  clientRunId: string;
  protocolVersion: string;
  rulesetId: string;
  genesisDescriptor: VerifiedGameGenesisDescriptor;
  rootHash: string;
  headHash: string;
  stateHash: string;
  previousHeadHash: string | null;
  lastRequestHash: string;
  authoritativeState: GameState;
  gameMonth: number;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommitVerifiedRunInput {
  expectedParentHeadHash: string | null;
  run: LeaderboardRunRecord;
  head: Omit<VerifiedLeaderboardRunHeadRecord, "revision" | "createdAt" | "updatedAt">;
}

export interface VerifiedRunCommitResult {
  created: boolean;
  run: LeaderboardRunRecord;
  head: VerifiedLeaderboardRunHeadRecord;
}

export class LeaderboardValidationError extends Error {
  readonly code = "INVALID_VERIFIED_RUN";

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

export class LeaderboardUnknownRunHeadError extends Error {
  readonly code = "UNKNOWN_RUN_HEAD";

  constructor(message: string) {
    super(message);
    this.name = "LeaderboardUnknownRunHeadError";
  }
}

export class LeaderboardStaleRunHeadError extends Error {
  readonly code = "STALE_RUN_HEAD";

  constructor(message: string) {
    super(message);
    this.name = "LeaderboardStaleRunHeadError";
  }
}

export class LeaderboardRulesetUnsupportedError extends Error {
  readonly code = "RUN_RULESET_UNSUPPORTED";

  constructor(message: string) {
    super(message);
    this.name = "LeaderboardRulesetUnsupportedError";
  }
}

export class LeaderboardTickGapExceededError extends Error {
  readonly code = "RUN_TICK_GAP_EXCEEDED";

  constructor(message: string) {
    super(message);
    this.name = "LeaderboardTickGapExceededError";
  }
}

export class LeaderboardReplayRejectedError extends Error {
  readonly code = "RUN_REPLAY_REJECTED";

  constructor(message: string) {
    super(message);
    this.name = "LeaderboardReplayRejectedError";
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
    verificationStatus: input.verificationStatus,
    metrics: { ...input.metrics },
    gameMonth: input.gameMonth,
    submittedAt,
    updatedAt,
  };
}
