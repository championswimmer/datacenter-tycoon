import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { ServerDrizzleDatabase } from "../db/client.js";
import { leaderboardRuns } from "../db/schema.js";
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

export class DrizzleLeaderboardRepository implements LeaderboardRepository {
  readonly #database: ServerDrizzleDatabase;

  constructor(database: ServerDrizzleDatabase) {
    this.#database = database;
  }

  async upsertRun(submission: LeaderboardRunSubmission): Promise<LeaderboardUpsertResult> {
    const existingRun = await this.findRun(submission.playerId, submission.clientRunId);

    if (existingRun) {
      return this.handleExistingRun(existingRun, submission);
    }

    const inserted = await this.#database
      .insert(leaderboardRuns)
      .values(buildRunInsert(submission))
      .onConflictDoNothing({
        target: [leaderboardRuns.playerId, leaderboardRuns.clientRunId],
      })
      .returning();

    if (inserted[0]) {
      return {
        created: true,
        run: mapLeaderboardRunRow(inserted[0]),
      };
    }

    const conflictedRun = await this.findRun(submission.playerId, submission.clientRunId);

    if (!conflictedRun) {
      throw new Error("Expected conflicting leaderboard run to exist after upsert.");
    }

    return this.handleExistingRun(conflictedRun, submission);
  }

  async listRuns(query: LeaderboardQuery): Promise<LeaderboardRunRecord[]> {
    const totalCapacityExpression = sql<number>`
      ${leaderboardRuns.computeCapacity}
      + ${leaderboardRuns.memoryCapacity}
      + ${leaderboardRuns.storageCapacity}
      + ${leaderboardRuns.gpuCapacity}
    `;

    const rows = await this.#database
      .select()
      .from(leaderboardRuns)
      .orderBy(...resolveOrderExpressions(query.metric, totalCapacityExpression))
      .limit(query.limit);

    return rows.map((row) => mapLeaderboardRunRow(row));
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
    const [updated] = await this.#database
      .update(leaderboardRuns)
      .set({
        money: submission.metrics.money,
        cumulativeRevenue: submission.metrics.cumulativeRevenue,
        totalServers: submission.metrics.totalServers,
        computeCapacity: submission.metrics.computeCapacity,
        memoryCapacity: submission.metrics.memoryCapacity,
        storageCapacity: submission.metrics.storageCapacity,
        gpuCapacity: submission.metrics.gpuCapacity,
        gameMonth: submission.gameMonth,
        updatedAt: new Date(),
      })
      .where(eq(leaderboardRuns.id, existingRun.runId))
      .returning();

    return {
      created: false,
      run: mapLeaderboardRunRow(updated),
    };
  }

  private async findRun(
    playerId: string,
    clientRunId: string,
  ): Promise<LeaderboardRunRecord | null> {
    const [row] = await this.#database
      .select()
      .from(leaderboardRuns)
      .where(and(eq(leaderboardRuns.playerId, playerId), eq(leaderboardRuns.clientRunId, clientRunId)))
      .limit(1);

    return row ? mapLeaderboardRunRow(row) : null;
  }
}

function buildRunKey(playerId: string, clientRunId: string): string {
  return `${playerId}:${clientRunId}`;
}

function buildRunInsert(submission: LeaderboardRunSubmission): typeof leaderboardRuns.$inferInsert {
  return {
    id: generateLeaderboardRunId(),
    playerId: submission.playerId,
    clientRunId: submission.clientRunId,
    money: submission.metrics.money,
    cumulativeRevenue: submission.metrics.cumulativeRevenue,
    totalServers: submission.metrics.totalServers,
    computeCapacity: submission.metrics.computeCapacity,
    memoryCapacity: submission.metrics.memoryCapacity,
    storageCapacity: submission.metrics.storageCapacity,
    gpuCapacity: submission.metrics.gpuCapacity,
    gameMonth: submission.gameMonth,
  };
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

function resolveOrderExpressions(
  metric: LeaderboardQueryMetric,
  totalCapacityExpression: ReturnType<typeof sql<number>>,
) {
  switch (metric) {
    case "money":
      return [
        desc(leaderboardRuns.money),
        asc(leaderboardRuns.submittedAt),
        asc(leaderboardRuns.clientRunId),
        asc(leaderboardRuns.id),
      ] as const;
    case "cumulativeRevenue":
      return [
        desc(leaderboardRuns.cumulativeRevenue),
        asc(leaderboardRuns.submittedAt),
        asc(leaderboardRuns.clientRunId),
        asc(leaderboardRuns.id),
      ] as const;
    case "totalServers":
      return [
        desc(leaderboardRuns.totalServers),
        asc(leaderboardRuns.submittedAt),
        asc(leaderboardRuns.clientRunId),
        asc(leaderboardRuns.id),
      ] as const;
    case "computeCapacity":
      return [
        desc(leaderboardRuns.computeCapacity),
        asc(leaderboardRuns.submittedAt),
        asc(leaderboardRuns.clientRunId),
        asc(leaderboardRuns.id),
      ] as const;
    case "memoryCapacity":
      return [
        desc(leaderboardRuns.memoryCapacity),
        asc(leaderboardRuns.submittedAt),
        asc(leaderboardRuns.clientRunId),
        asc(leaderboardRuns.id),
      ] as const;
    case "storageCapacity":
      return [
        desc(leaderboardRuns.storageCapacity),
        asc(leaderboardRuns.submittedAt),
        asc(leaderboardRuns.clientRunId),
        asc(leaderboardRuns.id),
      ] as const;
    case "gpuCapacity":
      return [
        desc(leaderboardRuns.gpuCapacity),
        asc(leaderboardRuns.submittedAt),
        asc(leaderboardRuns.clientRunId),
        asc(leaderboardRuns.id),
      ] as const;
    case "totalCapacity":
      return [
        desc(totalCapacityExpression),
        asc(leaderboardRuns.submittedAt),
        asc(leaderboardRuns.clientRunId),
        asc(leaderboardRuns.id),
      ] as const;
  }
}

function mapLeaderboardRunRow(
  row: typeof leaderboardRuns.$inferSelect | undefined,
): LeaderboardRunRecord {
  if (!row) {
    throw new Error("Expected leaderboard run row to be present.");
  }

  return {
    runId: row.id,
    playerId: row.playerId,
    clientRunId: row.clientRunId,
    metrics: {
      money: Number(row.money),
      cumulativeRevenue: Number(row.cumulativeRevenue),
      totalServers: Number(row.totalServers),
      computeCapacity: Number(row.computeCapacity),
      memoryCapacity: Number(row.memoryCapacity),
      storageCapacity: Number(row.storageCapacity),
      gpuCapacity: Number(row.gpuCapacity),
    },
    gameMonth: Number(row.gameMonth),
    submittedAt: new Date(row.submittedAt),
    updatedAt: new Date(row.updatedAt),
  };
}
