import { summarizeLeaderboardFromState, type LeaderboardStateSummary } from "../query/leaderboard.js";
import { reduce, type Action } from "../state/reduce.js";
import type { GameState } from "../types.js";

export const LEADERBOARD_VERIFICATION_ACTION_TYPES = [
	"BuildDatacenter",
	"PlaceRack",
	"RemoveRack",
	"MoveRack",
	"AcceptContract",
	"CancelContract",
	"FabricLink",
	"UpgradeDatacenter",
	"SetMaintenanceStaff",
	"Subtick",
	"Tick",
] as const;

export type LeaderboardVerificationActionType =
	(typeof LEADERBOARD_VERIFICATION_ACTION_TYPES)[number];

export type LeaderboardVerificationAction = Extract<
	Action,
	{ type: LeaderboardVerificationActionType }
>;

export interface LeaderboardVerificationReplayResult {
	state: GameState;
	summary: LeaderboardStateSummary;
}

export function replayLeaderboardVerificationActions(
	initialState: GameState,
	actions: readonly LeaderboardVerificationAction[],
): LeaderboardVerificationReplayResult {
	const state = actions.reduce<GameState>((currentState, action) => reduce(currentState, action), initialState);

	return {
		state,
		summary: summarizeLeaderboardFromState(state),
	};
}
