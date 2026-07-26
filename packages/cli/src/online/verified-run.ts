import type {
  Action,
  Difficulty,
  GameState,
  LeaderboardVerificationAction,
} from "@datacenter-tycoon/game-logic";
import { LEADERBOARD_VERIFICATION_ACTION_TYPES } from "@datacenter-tycoon/game-logic";

export const DEFAULT_VERIFIED_RUN_RULESET_ID = "leaderboard-ruleset-v1";
export const DEFAULT_VERIFIED_RUN_MAX_TICK_DELTA = 5;

export type CliVerifiedRunStatus = "pending-genesis" | "verified" | "sync-pending" | "local-only";

export interface CliVerifiedRunGenesis {
  seed: number;
  difficulty: Difficulty;
  clientRunId: string;
  rulesetId: string;
}

export interface CliVerifiedRunCursor {
  rootHash: string;
  headHash: string;
  acknowledgedTick: number;
}

export interface CliVerifiedRunState {
  status: CliVerifiedRunStatus;
  genesis: CliVerifiedRunGenesis;
  cursor: CliVerifiedRunCursor | null;
  pendingActions: LeaderboardVerificationAction[];
  maxTickDelta: number;
  lastErrorCode: string | null;
}

export interface VerifiedRunCheckpointSubmission {
  playerId: string;
  clientRunId: string;
  genesis?: {
    seed: number;
    difficulty: Difficulty;
    rulesetId: string;
  };
  parentHeadHash: string | null;
  actions: LeaderboardVerificationAction[];
}

export interface VerifiedRunCheckpointResponse {
  created: boolean;
  rootHash: string;
  headHash: string;
  gameMonth: number;
  metrics: {
    money: number;
    cumulativeRevenue: number;
    totalServers: number;
    computeCapacity: number;
    memoryCapacity: number;
    storageCapacity: number;
    gpuCapacity: number;
  };
}

export interface CliVerifiedRunController {
  getState(): CliVerifiedRunState;
  setState(state: CliVerifiedRunState): void;
  update(updater: (state: CliVerifiedRunState) => CliVerifiedRunState): CliVerifiedRunState;
}

const VERIFICATION_ACTION_TYPES = new Set<string>(LEADERBOARD_VERIFICATION_ACTION_TYPES);

export function createInitialVerifiedRunState(
  gameState: GameState,
  options: {
    onlineEligible?: boolean;
    rulesetId?: string;
    maxTickDelta?: number;
  } = {},
): CliVerifiedRunState {
  return {
    status: options.onlineEligible ? "pending-genesis" : "local-only",
    genesis: {
      seed: gameState.seed,
      difficulty: gameState.difficulty,
      clientRunId: gameState.gameId,
      rulesetId: options.rulesetId ?? DEFAULT_VERIFIED_RUN_RULESET_ID,
    },
    cursor: null,
    pendingActions: [],
    maxTickDelta: options.maxTickDelta ?? DEFAULT_VERIFIED_RUN_MAX_TICK_DELTA,
    lastErrorCode: null,
  };
}

export function createLegacyLocalOnlyVerifiedRunState(gameState: GameState): CliVerifiedRunState {
  return {
    ...createInitialVerifiedRunState(gameState, { onlineEligible: false }),
    status: "local-only",
  };
}

export function createVerifiedRunController(initialState: CliVerifiedRunState): CliVerifiedRunController {
  let state = initialState;

  return {
    getState() {
      return state;
    },
    setState(nextState) {
      state = nextState;
    },
    update(updater) {
      state = updater(state);
      return state;
    },
  };
}

export function isVerificationAction(action: Action): action is LeaderboardVerificationAction {
  return VERIFICATION_ACTION_TYPES.has(action.type);
}

export function appendVerificationAction(state: CliVerifiedRunState, action: Action): CliVerifiedRunState {
  if (state.status === "local-only" || !isVerificationAction(action)) {
    return state;
  }

  return {
    ...state,
    status: state.cursor ? "sync-pending" : "pending-genesis",
    pendingActions: [...state.pendingActions, cloneVerificationAction(action)],
  };
}

export function buildVerifiedCheckpointSubmission(
  playerId: string,
  verification: CliVerifiedRunState,
): VerifiedRunCheckpointSubmission | null {
  if (verification.status === "local-only" || verification.pendingActions.length === 0) {
    return null;
  }

  return {
    playerId,
    clientRunId: verification.genesis.clientRunId,
    genesis: verification.cursor
      ? undefined
      : {
          seed: verification.genesis.seed,
          difficulty: verification.genesis.difficulty,
          rulesetId: verification.genesis.rulesetId,
        },
    parentHeadHash: verification.cursor?.headHash ?? null,
    actions: verification.pendingActions.map(cloneVerificationAction),
  };
}

export function acknowledgeVerifiedCheckpoint(
  verification: CliVerifiedRunState,
  response: VerifiedRunCheckpointResponse,
): CliVerifiedRunState {
  return {
    ...verification,
    status: "verified",
    cursor: {
      rootHash: response.rootHash,
      headHash: response.headHash,
      acknowledgedTick: response.gameMonth,
    },
    pendingActions: [],
    lastErrorCode: null,
  };
}

export function markVerifiedRunSyncFailure(
  verification: CliVerifiedRunState,
  errorCode: string | null,
  gameState: Pick<GameState, "tick">,
): CliVerifiedRunState {
  if (verification.status === "local-only") {
    return verification;
  }

  if (getPendingTickDelta(verification, gameState) > verification.maxTickDelta) {
    return {
      ...verification,
      status: "local-only",
      lastErrorCode: errorCode,
    };
  }

  return {
    ...verification,
    status: verification.pendingActions.length > 0 ? "sync-pending" : verification.status,
    lastErrorCode: errorCode,
  };
}

export function getPendingTickDelta(
  verification: Pick<CliVerifiedRunState, "cursor">,
  gameState: Pick<GameState, "tick">,
): number {
  return gameState.tick - (verification.cursor?.acknowledgedTick ?? 0);
}

export function getLastEligibleGameMonth(
  verification: Pick<CliVerifiedRunState, "cursor" | "maxTickDelta">,
): number {
  return (verification.cursor?.acknowledgedTick ?? 0) + verification.maxTickDelta;
}

function cloneVerificationAction(action: LeaderboardVerificationAction): LeaderboardVerificationAction {
  return JSON.parse(JSON.stringify(action)) as LeaderboardVerificationAction;
}
