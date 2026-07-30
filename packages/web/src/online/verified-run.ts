import type {
  Action,
  Difficulty,
  GameState,
  LeaderboardVerificationAction,
} from "@datacenter-tycoon/game-logic";
import { LEADERBOARD_VERIFICATION_ACTION_TYPES } from "@datacenter-tycoon/game-logic";

export const DEFAULT_VERIFIED_RUN_RULESET_ID = "leaderboard-ruleset-v1";
/**
 * How many completed game months a run may drift from its acknowledged
 * checkpoint before it stops being eligible for verified submission. Mirrors
 * the backend's LEADERBOARD_VERIFICATION_MAX_TICK_DELTA — the server replays
 * and verifies the whole gap, so this only needs to stay in step with it.
 */
export const DEFAULT_VERIFIED_RUN_MAX_TICK_DELTA = 15;

export type WebVerifiedRunStatus = "pending-genesis" | "verified" | "sync-pending" | "local-only";

export interface WebVerifiedRunGenesis {
  seed: number;
  difficulty: Difficulty;
  clientRunId: string;
  rulesetId: string;
}

export interface WebVerifiedRunCursor {
  rootHash: string;
  headHash: string;
  acknowledgedTick: number;
}

export interface WebVerifiedRunState {
  status: WebVerifiedRunStatus;
  genesis: WebVerifiedRunGenesis;
  cursor: WebVerifiedRunCursor | null;
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

export interface WebVerifiedRunController {
  getState(): WebVerifiedRunState;
  setState(state: WebVerifiedRunState): void;
  update(updater: (state: WebVerifiedRunState) => WebVerifiedRunState): WebVerifiedRunState;
}

const VERIFICATION_ACTION_TYPES = new Set<string>(LEADERBOARD_VERIFICATION_ACTION_TYPES);

export function createInitialVerifiedRunState(
  gameState: GameState,
  options: {
    onlineEligible?: boolean;
    rulesetId?: string;
    maxTickDelta?: number;
  } = {},
): WebVerifiedRunState {
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

export function createLegacyLocalOnlyVerifiedRunState(
  gameState: GameState,
  options: {
    rulesetId?: string;
    maxTickDelta?: number;
  } = {},
): WebVerifiedRunState {
  return {
    ...createInitialVerifiedRunState(gameState, {
      onlineEligible: false,
      rulesetId: options.rulesetId,
      maxTickDelta: options.maxTickDelta,
    }),
    status: "local-only",
  };
}

/**
 * Saves written before the allowance was raised carry the older, stricter
 * ceiling. The backend decides what it will actually verify, so lift a stale
 * value instead of stranding an in-progress run at the limit it was saved with.
 */
export function restoreVerifiedRunState(state: WebVerifiedRunState): WebVerifiedRunState {
  return state.maxTickDelta >= DEFAULT_VERIFIED_RUN_MAX_TICK_DELTA
    ? state
    : { ...state, maxTickDelta: DEFAULT_VERIFIED_RUN_MAX_TICK_DELTA };
}

export function createVerifiedRunController(initialState: WebVerifiedRunState): WebVerifiedRunController {
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

export function appendVerificationAction(
  state: WebVerifiedRunState,
  action: Action,
): WebVerifiedRunState {
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
  verification: WebVerifiedRunState,
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
  verification: WebVerifiedRunState,
  response: VerifiedRunCheckpointResponse,
): WebVerifiedRunState {
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
  verification: WebVerifiedRunState,
  errorCode: string | null,
  gameState: GameState,
): WebVerifiedRunState {
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
  verification: Pick<WebVerifiedRunState, "cursor">,
  gameState: Pick<GameState, "tick">,
): number {
  return gameState.tick - (verification.cursor?.acknowledgedTick ?? 0);
}

export function getRemainingTickAllowance(
  verification: Pick<WebVerifiedRunState, "cursor" | "maxTickDelta">,
  gameState: Pick<GameState, "tick">,
): number {
  return Math.max(0, verification.maxTickDelta - getPendingTickDelta(verification, gameState));
}

export function getLastEligibleGameMonth(
  verification: Pick<WebVerifiedRunState, "cursor" | "maxTickDelta">,
): number {
  return (verification.cursor?.acknowledgedTick ?? 0) + verification.maxTickDelta;
}

function cloneVerificationAction(action: LeaderboardVerificationAction): LeaderboardVerificationAction {
  return JSON.parse(JSON.stringify(action)) as LeaderboardVerificationAction;
}
