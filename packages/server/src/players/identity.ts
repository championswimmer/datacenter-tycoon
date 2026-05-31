export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 24;
const USERNAME_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9 ._-]*[A-Za-z0-9])?$/;

export class UsernameValidationError extends Error {
  readonly code = "INVALID_USERNAME";

  constructor(message: string) {
    super(message);
    this.name = "UsernameValidationError";
  }
}

export interface UsernameRegistration {
  username: string;
  normalizedUsername: string;
}

export interface RegisteredPlayer {
  playerId: string;
  username: string;
  normalizedUsername: string;
  createdAt: Date;
  lastSeenAt: Date;
}

export interface CreatePlayerInput {
  playerId: string;
  username: string;
  normalizedUsername: string;
  now?: Date;
}

export function parseUsernameRegistration(rawUsername: string): UsernameRegistration {
  const username = normalizeUsername(rawUsername);

  if (username.length < MIN_USERNAME_LENGTH) {
    throw new UsernameValidationError(
      `Username must be at least ${MIN_USERNAME_LENGTH} characters long.`,
    );
  }

  if (username.length > MAX_USERNAME_LENGTH) {
    throw new UsernameValidationError(
      `Username must be at most ${MAX_USERNAME_LENGTH} characters long.`,
    );
  }

  if (!USERNAME_PATTERN.test(username)) {
    throw new UsernameValidationError(
      "Username may only contain letters, numbers, spaces, periods, underscores, and hyphens.",
    );
  }

  return {
    username,
    normalizedUsername: username.toLocaleLowerCase("en-US"),
  };
}

export function normalizeUsername(rawUsername: string): string {
  return rawUsername
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ");
}

export function generatePlayerId(): string {
  return crypto.randomUUID();
}

export function createRegisteredPlayer(input: CreatePlayerInput): RegisteredPlayer {
  const now = input.now ?? new Date();

  return {
    playerId: input.playerId,
    username: input.username,
    normalizedUsername: input.normalizedUsername,
    createdAt: now,
    lastSeenAt: now,
  };
}
