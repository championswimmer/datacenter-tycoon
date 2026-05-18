import type { Pool } from "pg";
import {
  getMetricValue,
  type LeaderboardQuery,
  type LeaderboardQueryMetric,
} from "./queries.js";
import {
  createLeaderboardRunRecord,
  generateLeaderboardRunId,
  leaderboardRunMatchesSubmission,
  type LeaderboardRunRecord,
  type LeaderboardRunSubmission,
} from "./types.js";
import { assertMonotonicRunUpdate } from "./validation.js";

export interface LeaderboardUpsertResult {
  created: boolean;
  run: LeaderboardRunRecord;
}

export interface LeaderboardRepository {
  upsertRun(submission: LeaderboardRunSubmission): Promise<LeaderboardUpsertResult>;
  listRuns(query: LeaderboardQuery): Promise<LeaderboardRunRecord[]>;
}

export class InMemoryLeaderboardRepository implements LeaderboardRepository {
  readonly #runsByKey = new Map<string, LeaderboardRunRecord>();
  readonly #clock: () => Date;

  constructor(clock: () => Date = () => new Date()) {
    this.#clock = clock;
  }

  async upsertRun(submission: LeaderboardRunSubmission): Promise<LeaderboardUpsertResult> {
    const key = buildRunKey(submission.playerId, submission.clientRunId);
    const existingRun = this.#runsByKey.get(key);

    if (existingRun) {
      if (leaderboardRunMatchesSubmission(existingRun, submission)) {
        return {
          created: false,
          run: existingRun,
        };
      }

      assertMonotonicRunUpdate(existingRun, submission);
      const updatedRun = createLeaderboardRunRecord({
        ...submission,
        runId: existingRun.runId,
        submittedAt: existingRun.submittedAt,
        updatedAt: this.#clock(),
      });
      this.#runsByKey.set(key, updatedRun);

      return {
        created: false,
        run: updatedRun,
      };
    }

    const submittedAt = this.#clock();
    const run = createLeaderboardRunRecord({
      ...submission,
      runId: generateLeaderboardRunId(),
      submittedAt,
      updatedAt: submittedAt,
    });
    this.#runsByKey.set(key, run);

    return {
      created: true,
      run,
    };
  }

  async listRuns(query: LeaderboardQuery): Promise<LeaderboardRunRecord[]> {
    return [...this.#runsByKey.values()]
      .sort((left, right) => compareLeaderboardRuns(left, right, query.metric))
      .slice(0, query.limit);
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
      return this.handleExistingRun(existingRun, submission);
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

      return this.handleExistingRun(conflictedRun, submission);
    }
  }

  async listRuns(query: LeaderboardQuery): Promise<LeaderboardRunRecord[]> {
    const metricExpression = resolveMetricExpression(query.metric);
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
        ORDER BY ${metricExpression} DESC, submitted_at ASC, client_run_id ASC, id ASC
        LIMIT $1
      `,
      [query.limit],
    );

    return result.rows.map((row) => mapLeaderboardRunRow(row));
  }

  private async handleExistingRun(
    existingRun: LeaderboardRunRecord,
    submission: LeaderboardRunSubmission,
  ): Promise<LeaderboardUpsertResult> {
    if (leaderboardRunMatchesSubmission(existingRun, submission)) {
      return {
        created: false,
        run: existingRun,
      };
    }

    assertMonotonicRunUpdate(existingRun, submission);
    const result = await this.#database.query<LeaderboardRunRow>(
      `
        UPDATE leaderboard_runs
        SET
          money = $2,
          cumulative_revenue = $3,
          total_servers = $4,
          compute_capacity = $5,
          memory_capacity = $6,
          storage_capacity = $7,
          gpu_capacity = $8,
          game_month = $9,
          updated_at = NOW()
        WHERE id = $1
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
        existingRun.runId,
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
      created: false,
      run: mapLeaderboardRunRow(result.rows[0]),
    };
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

function compareLeaderboardRuns(
  left: LeaderboardRunRecord,
  right: LeaderboardRunRecord,
  metric: LeaderboardQueryMetric,
): number {
  const metricDelta = getMetricValue(right, metric) - getMetricValue(left, metric);

  if (metricDelta !== 0) {
    return metricDelta;
  }

  const submittedAtDelta = left.submittedAt.getTime() - right.submittedAt.getTime();

  if (submittedAtDelta !== 0) {
    return submittedAtDelta;
  }

  const clientRunDelta = left.clientRunId.localeCompare(right.clientRunId);

  if (clientRunDelta !== 0) {
    return clientRunDelta;
  }

  return left.runId.localeCompare(right.runId);
}

function resolveMetricExpression(metric: LeaderboardQueryMetric): string {
  switch (metric) {
    case "money":
      return "money";
    case "cumulativeRevenue":
      return "cumulative_revenue";
    case "totalServers":
      return "total_servers";
    case "computeCapacity":
      return "compute_capacity";
    case "memoryCapacity":
      return "memory_capacity";
    case "storageCapacity":
      return "storage_capacity";
    case "gpuCapacity":
      return "gpu_capacity";
    case "totalCapacity":
      return "(compute_capacity + memory_capacity + storage_capacity + gpu_capacity)";
  }
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
