import type { Pool } from "pg";
import {
  createLeaderboardRunRecord,
  generateLeaderboardRunId,
  leaderboardRunMatchesSubmission,
  LeaderboardRunConflictError,
  type LeaderboardRunRecord,
  type LeaderboardRunSubmission,
} from "./types.js";

export interface LeaderboardUpsertResult {
  created: boolean;
  run: LeaderboardRunRecord;
}

export interface LeaderboardRepository {
  upsertRun(submission: LeaderboardRunSubmission): Promise<LeaderboardUpsertResult>;
}

export class InMemoryLeaderboardRepository implements LeaderboardRepository {
  readonly #runsByKey = new Map<string, LeaderboardRunRecord>();

  async upsertRun(submission: LeaderboardRunSubmission): Promise<LeaderboardUpsertResult> {
    const key = buildRunKey(submission.playerId, submission.clientRunId);
    const existingRun = this.#runsByKey.get(key);

    if (existingRun) {
      if (!leaderboardRunMatchesSubmission(existingRun, submission)) {
        throw new LeaderboardRunConflictError(
          `clientRunId ${submission.clientRunId} is already associated with a different run summary.`,
        );
      }

      return {
        created: false,
        run: existingRun,
      };
    }

    const run = createLeaderboardRunRecord({
      ...submission,
      runId: generateLeaderboardRunId(),
    });
    this.#runsByKey.set(key, run);

    return {
      created: true,
      run,
    };
  }
}

interface LeaderboardRunRow {
  id: string;
  player_id: string;
  client_run_id: string;
  money: string | number;
  cumulative_revenue: string | number;
  total_servers: number;
  compute_capacity: string | number;
  memory_capacity: string | number;
  storage_capacity: string | number;
  gpu_capacity: string | number;
  game_month: number;
  submitted_at: Date;
  updated_at: Date;
}

interface Queryable {
  query: Pool["query"];
}

export class PostgresLeaderboardRepository implements LeaderboardRepository {
  readonly #database: Queryable;

  constructor(database: Queryable) {
    this.#database = database;
  }

  async upsertRun(submission: LeaderboardRunSubmission): Promise<LeaderboardUpsertResult> {
    const existingRun = await this.findRun(submission.playerId, submission.clientRunId);

    if (existingRun) {
      if (!leaderboardRunMatchesSubmission(existingRun, submission)) {
        throw new LeaderboardRunConflictError(
          `clientRunId ${submission.clientRunId} is already associated with a different run summary.`,
        );
      }

      return {
        created: false,
        run: existingRun,
      };
    }

    const runId = generateLeaderboardRunId();

    try {
      const result = await this.#database.query<LeaderboardRunRow>(
        `
          INSERT INTO leaderboard_runs (
            id,
            player_id,
            client_run_id,
            money,
            cumulative_revenue,
            total_servers,
            compute_capacity,
            memory_capacity,
            storage_capacity,
            gpu_capacity,
            game_month
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING
            id,
            player_id,
            client_run_id,
            money,
            cumulative_revenue,
            total_servers,
            compute_capacity,
            memory_capacity,
            storage_capacity,
            gpu_capacity,
            game_month,
            submitted_at,
            updated_at
        `,
        [
          runId,
          submission.playerId,
          submission.clientRunId,
          submission.metrics.money,
          submission.metrics.cumulativeRevenue,
          submission.metrics.totalServers,
          submission.metrics.computeCapacity,
          submission.metrics.memoryCapacity,
          submission.metrics.storageCapacity,
          submission.metrics.gpuCapacity,
          submission.gameMonth,
        ],
      );

      return {
        created: true,
        run: mapLeaderboardRunRow(result.rows[0]),
      };
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }

      const conflictedRun = await this.findRun(submission.playerId, submission.clientRunId);

      if (!conflictedRun) {
        throw error;
      }

      if (!leaderboardRunMatchesSubmission(conflictedRun, submission)) {
        throw new LeaderboardRunConflictError(
          `clientRunId ${submission.clientRunId} is already associated with a different run summary.`,
        );
      }

      return {
        created: false,
        run: conflictedRun,
      };
    }
  }

  private async findRun(
    playerId: string,
    clientRunId: string,
  ): Promise<LeaderboardRunRecord | null> {
    const result = await this.#database.query<LeaderboardRunRow>(
      `
        SELECT
          id,
          player_id,
          client_run_id,
          money,
          cumulative_revenue,
          total_servers,
          compute_capacity,
          memory_capacity,
          storage_capacity,
          gpu_capacity,
          game_month,
          submitted_at,
          updated_at
        FROM leaderboard_runs
        WHERE player_id = $1 AND client_run_id = $2
      `,
      [playerId, clientRunId],
    );

    return result.rows[0] ? mapLeaderboardRunRow(result.rows[0]) : null;
  }
}

function buildRunKey(playerId: string, clientRunId: string): string {
  return `${playerId}:${clientRunId}`;
}

function mapLeaderboardRunRow(row: LeaderboardRunRow | undefined): LeaderboardRunRecord {
  if (!row) {
    throw new Error("Expected leaderboard run row to be present.");
  }

  return {
    runId: row.id,
    playerId: row.player_id,
    clientRunId: row.client_run_id,
    metrics: {
      money: Number(row.money),
      cumulativeRevenue: Number(row.cumulative_revenue),
      totalServers: Number(row.total_servers),
      computeCapacity: Number(row.compute_capacity),
      memoryCapacity: Number(row.memory_capacity),
      storageCapacity: Number(row.storage_capacity),
      gpuCapacity: Number(row.gpu_capacity),
    },
    gameMonth: Number(row.game_month),
    submittedAt: new Date(row.submitted_at),
    updatedAt: new Date(row.updated_at),
  };
}

function isUniqueViolation(error: unknown): error is { code: string } {
  return error !== null
    && typeof error === "object"
    && "code" in error
    && (error as { code?: unknown }).code === "23505";
}
