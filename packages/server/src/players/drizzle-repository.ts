import { eq } from "drizzle-orm";
import type { ServerDrizzleDatabase } from "../db/client.js";
import { players } from "../db/schema.js";
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

export class DrizzlePlayersRepository implements PlayersRepository {
  readonly #database: ServerDrizzleDatabase;

  constructor(database: ServerDrizzleDatabase) {
    this.#database = database;
  }

  async findByNormalizedUsername(normalizedUsername: string): Promise<RegisteredPlayer | null> {
    const [row] = await this.#database
      .select()
      .from(players)
      .where(eq(players.normalizedUsername, normalizedUsername))
      .limit(1);

    return row ? mapPlayerRow(row) : null;
  }

  async findByPlayerId(playerId: string): Promise<RegisteredPlayer | null> {
    const [row] = await this.#database
      .select()
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    return row ? mapPlayerRow(row) : null;
  }

  async createPlayer(input: RegisterPlayerInput): Promise<RegisteredPlayer> {
    const parsed = parseUsernameRegistration(input.username);
    const player = createRegisteredPlayer({
      playerId: generatePlayerId(),
      username: parsed.username,
      normalizedUsername: parsed.normalizedUsername,
    });

    const inserted = await this.#database
      .insert(players)
      .values({
        id: player.playerId,
        username: player.username,
        normalizedUsername: player.normalizedUsername,
        createdAt: player.createdAt,
        lastSeenAt: player.lastSeenAt,
      })
      .onConflictDoNothing({
        target: players.normalizedUsername,
      })
      .returning();

    if (!inserted[0]) {
      throw new UsernameUnavailableError(`Username is already taken: ${parsed.username}`);
    }

    return mapPlayerRow(inserted[0]);
  }

  async touchPlayer(playerId: string, seenAt = new Date()): Promise<void> {
    await this.#database
      .update(players)
      .set({
        lastSeenAt: seenAt,
      })
      .where(eq(players.id, playerId));
  }
}

function mapPlayerRow(row: typeof players.$inferSelect): RegisteredPlayer {
  return {
    playerId: row.id,
    username: row.username,
    normalizedUsername: row.normalizedUsername,
    createdAt: new Date(row.createdAt),
    lastSeenAt: new Date(row.lastSeenAt),
  };
}
