import { HttpError } from "../server/app.js";
import type { PlayersRepository } from "../players/repository.js";
import {
  parseLeaderboardQuery,
  queryLeaderboard,
  type LeaderboardEntry,
  type LeaderboardQuery,
  LeaderboardQueryValidationError,
} from "./queries.js";
import type { LeaderboardRepository, LeaderboardUpsertResult } from "./repository.js";
import {
  LeaderboardPlayerNotFoundError,
  LeaderboardRunConflictError,
  LeaderboardRunRegressionError,
  LeaderboardValidationError,
} from "./types.js";
import { parseLeaderboardRunSubmission } from "./validation.js";

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
): Promise<LeaderboardUpsertResult> {
  try {
    const submission = parseLeaderboardRunSubmission(payload);
    const player = await playersRepository.findByPlayerId(submission.playerId);

    if (!player) {
      throw new LeaderboardPlayerNotFoundError(
        `Unknown player id: ${submission.playerId}`,
      );
    }

    const result = await leaderboardRepository.upsertRun(submission);
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

  if (error instanceof LeaderboardRunConflictError) {
    return new HttpError(409, error.code, error.message);
  }

  if (error instanceof LeaderboardRunRegressionError) {
    return new HttpError(409, error.code, error.message);
  }

  return error;
}
