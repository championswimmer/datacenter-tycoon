import {
  createRegisteredPlayer,
  generatePlayerId,
  parseUsernameRegistration,
  type RegisteredPlayer,
} from "./identity.js";

export interface RegisterPlayerInput {
  username: string;
}

export class UsernameUnavailableError extends Error {
  readonly code = "USERNAME_UNAVAILABLE";

  constructor(message: string) {
    super(message);
    this.name = "UsernameUnavailableError";
  }
}

export interface PlayersRepository {
  findByNormalizedUsername(normalizedUsername: string): Promise<RegisteredPlayer | null>;
  findByPlayerId(playerId: string): Promise<RegisteredPlayer | null>;
  createPlayer(input: RegisterPlayerInput): Promise<RegisteredPlayer>;
  touchPlayer(playerId: string, seenAt?: Date): Promise<void>;
}

export class InMemoryPlayersRepository implements PlayersRepository {
  readonly #playersById = new Map<string, RegisteredPlayer>();
  readonly #playerIdsByNormalizedUsername = new Map<string, string>();

  async findByNormalizedUsername(normalizedUsername: string): Promise<RegisteredPlayer | null> {
    const playerId = this.#playerIdsByNormalizedUsername.get(normalizedUsername);
    return playerId ? this.#playersById.get(playerId) ?? null : null;
  }

  async findByPlayerId(playerId: string): Promise<RegisteredPlayer | null> {
    return this.#playersById.get(playerId) ?? null;
  }

  async createPlayer(input: RegisterPlayerInput): Promise<RegisteredPlayer> {
    const parsed = parseUsernameRegistration(input.username);
    const existingPlayerId = this.#playerIdsByNormalizedUsername.get(parsed.normalizedUsername);

    if (existingPlayerId) {
      throw new UsernameUnavailableError(`Username is already taken: ${parsed.username}`);
    }

    const player = createRegisteredPlayer({
      playerId: generatePlayerId(),
      username: parsed.username,
      normalizedUsername: parsed.normalizedUsername,
    });

    this.#playersById.set(player.playerId, player);
    this.#playerIdsByNormalizedUsername.set(player.normalizedUsername, player.playerId);
    return player;
  }

  async touchPlayer(playerId: string, seenAt = new Date()): Promise<void> {
    const player = this.#playersById.get(playerId);

    if (!player) {
      return;
    }

    this.#playersById.set(playerId, {
      ...player,
      lastSeenAt: seenAt,
    });
  }
}
