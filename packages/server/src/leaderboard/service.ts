import type { ServerConfig } from "../config.js";
import { HttpError } from "../server/errors.js";
import type { PlayersRepository } from "../players/repository.js";
import {
  parseLeaderboardQuery,
  queryLeaderboard,
  type LeaderboardEntry,
  type LeaderboardQuery,
  LeaderboardQueryValidationError,
} from "./queries.js";
import type { LeaderboardRepository } from "./repository.js";
import {
  submitVerifiedCheckpoint,
  type VerifiedCheckpointResponse,
} from "./verification.js";
import {
  LeaderboardPlayerNotFoundError,
  LeaderboardReplayRejectedError,
  LeaderboardRulesetUnsupportedError,
  LeaderboardStaleRunHeadError,
  LeaderboardTickGapExceededError,
  LeaderboardUnknownRunHeadError,
  LeaderboardValidationError,
} from "./types.js";
import { parseVerifiedRunCheckpointSubmission } from "./validation.js";

export async function queryLeaderboardEntries(
  playersRepository: PlayersRepository,
  leaderboardRepository: LeaderboardRepository,
  searchParams: URLSearchParams,
): Promise<{ query: LeaderboardQuery; entries: LeaderboardEntry[] }> {
  try {
    const query = parseLeaderboardQuery(searchParams);
    const entries = await queryLeaderboard(playersRepository, leaderboardRepository, query);

    return {
      query,
      entries,
    };
  } catch (error) {
    throw normalizeLeaderboardError(error);
  }
}

export async function submitLeaderboardRun(
  playersRepository: PlayersRepository,
  leaderboardRepository: LeaderboardRepository,
  payload: unknown,
  config: Pick<ServerConfig, "leaderboardVerification">,
): Promise<VerifiedCheckpointResponse> {
  try {
    const submission = parseVerifiedRunCheckpointSubmission(payload);
    const player = await playersRepository.findByPlayerId(submission.playerId);

    if (!player) {
      throw new LeaderboardPlayerNotFoundError(
        `Unknown player id: ${submission.playerId}`,
      );
    }

    const result = await submitVerifiedCheckpoint(
      leaderboardRepository,
      player,
      submission,
      config,
    );
    await playersRepository.touchPlayer(submission.playerId);
    return result;
  } catch (error) {
    throw normalizeLeaderboardError(error);
  }
}

function normalizeLeaderboardError(error: unknown): unknown {
  if (error instanceof LeaderboardValidationError) {
    return new HttpError(400, error.code, error.message);
  }

  if (error instanceof LeaderboardQueryValidationError) {
    return new HttpError(400, error.code, error.message);
  }

  if (error instanceof LeaderboardPlayerNotFoundError) {
    return new HttpError(404, error.code, error.message);
  }

  if (error instanceof LeaderboardUnknownRunHeadError) {
    return new HttpError(404, error.code, error.message);
  }

  if (error instanceof LeaderboardStaleRunHeadError) {
    return new HttpError(409, error.code, error.message);
  }

  if (error instanceof LeaderboardRulesetUnsupportedError) {
    return new HttpError(409, error.code, error.message);
  }

  if (error instanceof LeaderboardTickGapExceededError) {
    return new HttpError(409, error.code, error.message);
  }

  if (error instanceof LeaderboardReplayRejectedError) {
    return new HttpError(409, error.code, error.message);
  }

  return error;
}
