import { HttpError } from "../server/app.js";
import type { PlayersRepository } from "../players/repository.js";
import type { LeaderboardRepository, LeaderboardUpsertResult } from "./repository.js";
import {
  LeaderboardPlayerNotFoundError,
  LeaderboardRunConflictError,
  LeaderboardValidationError,
} from "./types.js";
import { parseLeaderboardRunSubmission } from "./validation.js";

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

  if (error instanceof LeaderboardPlayerNotFoundError) {
    return new HttpError(404, error.code, error.message);
  }

  if (error instanceof LeaderboardRunConflictError) {
    return new HttpError(409, error.code, error.message);
  }

  return error;
}
