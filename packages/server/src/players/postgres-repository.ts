import type { Pool } from "pg";
import {
  createRegisteredPlayer,
  generatePlayerId,
  parseUsernameRegistration,
  type RegisteredPlayer,
} from "./identity.js";
import {
  type PlayersRepository,
  type RegisterPlayerInput,
  UsernameUnavailableError,
} from "./repository.js";

interface Queryable {
  query: Pool["query"];
}

interface PlayerRow {
  id: string;
  username: string;
  normalized_username: string;
  created_at: Date;
  last_seen_at: Date;
}

export class PostgresPlayersRepository implements PlayersRepository {
  readonly #database: Queryable;

  constructor(database: Queryable) {
    this.#database = database;
  }

  async findByNormalizedUsername(normalizedUsername: string): Promise<RegisteredPlayer | null> {
    const result = await this.#database.query<PlayerRow>(
      `
        SELECT id, username, normalized_username, created_at, last_seen_at
        FROM players
        WHERE normalized_username = $1
      `,
      [normalizedUsername],
    );

    return result.rows[0] ? mapPlayerRow(result.rows[0]) : null;
  }

  async findByPlayerId(playerId: string): Promise<RegisteredPlayer | null> {
    const result = await this.#database.query<PlayerRow>(
      `
        SELECT id, username, normalized_username, created_at, last_seen_at
        FROM players
        WHERE id = $1
      `,
      [playerId],
    );

    return result.rows[0] ? mapPlayerRow(result.rows[0]) : null;
  }

  async createPlayer(input: RegisterPlayerInput): Promise<RegisteredPlayer> {
    const parsed = parseUsernameRegistration(input.username);
    const player = createRegisteredPlayer({
      playerId: generatePlayerId(),
      username: parsed.username,
      normalizedUsername: parsed.normalizedUsername,
    });

    try {
      await this.#database.query(
        `
          INSERT INTO players (id, username, normalized_username, created_at, last_seen_at)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [
          player.playerId,
          player.username,
          player.normalizedUsername,
          player.createdAt,
          player.lastSeenAt,
        ],
      );
      return player;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new UsernameUnavailableError(`Username is already taken: ${parsed.username}`);
      }

      throw error;
    }
  }

  async touchPlayer(playerId: string, seenAt = new Date()): Promise<void> {
    await this.#database.query(
      `
        UPDATE players
        SET last_seen_at = $2
        WHERE id = $1
      `,
      [playerId, seenAt],
    );
  }
}

function mapPlayerRow(row: PlayerRow): RegisteredPlayer {
  return {
    playerId: row.id,
    username: row.username,
    normalizedUsername: row.normalized_username,
    createdAt: new Date(row.created_at),
    lastSeenAt: new Date(row.last_seen_at),
  };
}

function isUniqueViolation(error: unknown): error is { code: string } {
  return error !== null
    && typeof error === "object"
    && "code" in error
    && (error as { code?: unknown }).code === "23505";
}
