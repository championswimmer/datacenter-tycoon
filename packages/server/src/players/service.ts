import { HttpError } from "../server/app.js";
import {
  parseUsernameRegistration,
  UsernameValidationError,
} from "./identity.js";
import {
  type PlayersRepository,
  UsernameUnavailableError,
} from "./repository.js";

export async function checkUsernameAvailability(
  repository: PlayersRepository,
  rawUsername: string,
): Promise<{ username: string; available: boolean }> {
  try {
    const parsed = parseUsernameRegistration(rawUsername);
    const existingPlayer = await repository.findByNormalizedUsername(parsed.normalizedUsername);

    return {
      username: parsed.username,
      available: existingPlayer === null,
    };
  } catch (error) {
    throw normalizePlayerError(error);
  }
}

export async function registerPlayerUsername(
  repository: PlayersRepository,
  rawUsername: string,
): Promise<{ playerId: string; username: string }> {
  try {
    const parsed = parseUsernameRegistration(rawUsername);
    const player = await repository.createPlayer({ username: parsed.username });
    return {
      playerId: player.playerId,
      username: player.username,
    };
  } catch (error) {
    throw normalizePlayerError(error);
  }
}

function normalizePlayerError(error: unknown): unknown {
  if (error instanceof UsernameUnavailableError) {
    return new HttpError(409, "USERNAME_UNAVAILABLE", error.message);
  }

  if (error instanceof UsernameValidationError) {
    return new HttpError(400, error.code, error.message);
  }

  return error;
}
