import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { GameState } from "@datacenter-tycoon/game-logic";
import type { ServerDrizzleDatabase } from "../db/client.js";
import type { ServerDatabaseConnection } from "../db/database.js";
import { leaderboardRuns, verifiedLeaderboardRunHeads } from "../db/schema.js";
import type { LeaderboardQuery, LeaderboardQueryMetric } from "./queries.js";
import {
  createLeaderboardRunRecord,
  generateLeaderboardRunId,
  LeaderboardStaleRunHeadError,
  type CommitVerifiedRunInput,
  type LeaderboardRunRecord,
  type VerifiedLeaderboardRunHeadRecord,
  type VerifiedRunCommitResult,
} from "./types.js";

export interface LeaderboardRepository {
  findRunHead(playerId: string, clientRunId: string): Promise<VerifiedLeaderboardRunHeadRecord | null>;
  commitVerifiedRun(input: CommitVerifiedRunInput): Promise<VerifiedRunCommitResult>;
  listRuns(query: LeaderboardQuery): Promise<LeaderboardRunRecord[]>;
}

export class InMemoryLeaderboardRepository implements LeaderboardRepository {
  readonly #runsByKey = new Map<string, LeaderboardRunRecord>();
  readonly #headsByKey = new Map<string, VerifiedLeaderboardRunHeadRecord>();
  readonly #clock: () => Date;

  constructor(clock: () => Date = () => new Date()) {
    this.#clock = clock;
  }

  async findRunHead(playerId: string, clientRunId: string): Promise<VerifiedLeaderboardRunHeadRecord | null> {
    return this.#headsByKey.get(buildRunKey(playerId, clientRunId)) ?? null;
  }

  async commitVerifiedRun(input: CommitVerifiedRunInput): Promise<VerifiedRunCommitResult> {
    const key = buildRunKey(input.run.playerId, input.run.clientRunId);
    const existingHead = this.#headsByKey.get(key);

    if (!existingHead) {
      if (input.expectedParentHeadHash !== null) {
        throw new LeaderboardStaleRunHeadError(
          `Run ${input.run.clientRunId} does not have a verified head for parent ${input.expectedParentHeadHash}.`,
        );
      }

      const now = this.#clock();
      const run = createLeaderboardRunRecord({
        ...input.run,
        runId: this.#runsByKey.get(key)?.runId ?? generateLeaderboardRunId(),
        submittedAt: this.#runsByKey.get(key)?.submittedAt ?? now,
        updatedAt: now,
      });
      const head: VerifiedLeaderboardRunHeadRecord = {
        ...input.head,
        revision: 1,
        createdAt: now,
        updatedAt: now,
      };
      this.#runsByKey.set(key, run);
      this.#headsByKey.set(key, head);

      return {
        created: true,
        run,
        head,
      };
    }

    if (existingHead.headHash !== input.expectedParentHeadHash) {
      throw new LeaderboardStaleRunHeadError(
        `Run ${input.run.clientRunId} expected parent ${input.expectedParentHeadHash}, current head is ${existingHead.headHash}.`,
      );
    }

    const now = this.#clock();
    const existingRun = this.#runsByKey.get(key);
    const run = createLeaderboardRunRecord({
      ...input.run,
      runId: existingRun?.runId ?? generateLeaderboardRunId(),
      submittedAt: existingRun?.submittedAt ?? now,
      updatedAt: now,
    });
    const head: VerifiedLeaderboardRunHeadRecord = {
      ...input.head,
      revision: existingHead.revision + 1,
      createdAt: existingHead.createdAt,
      updatedAt: now,
    };
    this.#runsByKey.set(key, run);
    this.#headsByKey.set(key, head);

    return {
      created: false,
      run,
      head,
    };
  }

  async listRuns(query: LeaderboardQuery): Promise<LeaderboardRunRecord[]> {
    return [...this.#runsByKey.values()]
      .filter((run) => {
        if (query.visibility === "all") {
          return true;
        }

        return run.verificationStatus === "verified"
          && this.#headsByKey.has(buildRunKey(run.playerId, run.clientRunId));
      })
      .sort((left, right) => compareLeaderboardRuns(left, right, query.metric))
      .slice(0, query.limit);
  }
}

export class DrizzleLeaderboardRepository implements LeaderboardRepository {
  readonly #database: ServerDrizzleDatabase;

  constructor(database: ServerDrizzleDatabase | ServerDatabaseConnection) {
    this.#database = "db" in database ? database.db : database;
  }

  async findRunHead(playerId: string, clientRunId: string): Promise<VerifiedLeaderboardRunHeadRecord | null> {
    const [row] = await this.#database
      .select()
      .from(verifiedLeaderboardRunHeads)
      .where(
        and(
          eq(verifiedLeaderboardRunHeads.playerId, playerId),
          eq(verifiedLeaderboardRunHeads.clientRunId, clientRunId),
        ),
      )
      .limit(1);

    return row ? mapVerifiedRunHeadRow(row) : null;
  }

  async commitVerifiedRun(input: CommitVerifiedRunInput): Promise<VerifiedRunCommitResult> {
    return this.#database.transaction(async (tx) => {
      const existingHead = await tx
        .select()
        .from(verifiedLeaderboardRunHeads)
        .where(
          and(
            eq(verifiedLeaderboardRunHeads.playerId, input.run.playerId),
            eq(verifiedLeaderboardRunHeads.clientRunId, input.run.clientRunId),
          ),
        )
        .limit(1)
        .then((rows) => rows[0]);

      if (!existingHead) {
        if (input.expectedParentHeadHash !== null) {
          throw new LeaderboardStaleRunHeadError(
            `Run ${input.run.clientRunId} does not have a verified head for parent ${input.expectedParentHeadHash}.`,
          );
        }
      } else if (existingHead.headHash !== input.expectedParentHeadHash) {
        throw new LeaderboardStaleRunHeadError(
          `Run ${input.run.clientRunId} expected parent ${input.expectedParentHeadHash}, current head is ${existingHead.headHash}.`,
        );
      }

      const [existingRun] = await tx
        .select()
        .from(leaderboardRuns)
        .where(
          and(
            eq(leaderboardRuns.playerId, input.run.playerId),
            eq(leaderboardRuns.clientRunId, input.run.clientRunId),
          ),
        )
        .limit(1);

      const runInsert = buildRunInsert(input, existingRun?.id ?? generateLeaderboardRunId(), existingRun?.submittedAt);
      let runRow: typeof leaderboardRuns.$inferSelect | undefined;

      if (existingRun) {
        [runRow] = await tx
          .update(leaderboardRuns)
          .set(runInsert)
          .where(eq(leaderboardRuns.id, existingRun.id))
          .returning();
      } else {
        [runRow] = await tx.insert(leaderboardRuns).values(runInsert).returning();
      }

      const headInsert = buildHeadInsert(input, existingHead?.revision ?? 0, existingHead?.createdAt);
      let headRow: typeof verifiedLeaderboardRunHeads.$inferSelect | undefined;

      if (existingHead) {
        [headRow] = await tx
          .update(verifiedLeaderboardRunHeads)
          .set(headInsert)
          .where(
            and(
              eq(verifiedLeaderboardRunHeads.playerId, input.run.playerId),
              eq(verifiedLeaderboardRunHeads.clientRunId, input.run.clientRunId),
            ),
          )
          .returning();
      } else {
        [headRow] = await tx.insert(verifiedLeaderboardRunHeads).values(headInsert).returning();
      }

      return {
        created: !existingHead,
        run: mapLeaderboardRunRow(runRow),
        head: mapVerifiedRunHeadRow(headRow),
      };
    });
  }

  async listRuns(query: LeaderboardQuery): Promise<LeaderboardRunRecord[]> {
    const totalCapacityExpression = sql<number>`
      ${leaderboardRuns.computeCapacity}
      + ${leaderboardRuns.memoryCapacity}
      + ${leaderboardRuns.storageCapacity}
      + ${leaderboardRuns.gpuCapacity}
    `;

    const orderBy = resolveOrderExpressions(query.metric, totalCapacityExpression);

    if (query.visibility === "all") {
      const rows = await this.#database
        .select()
        .from(leaderboardRuns)
        .orderBy(...orderBy)
        .limit(query.limit);

      return rows.map((row) => mapLeaderboardRunRow(row));
    }

    const rows = await this.#database
      .select({ run: leaderboardRuns })
      .from(leaderboardRuns)
      .innerJoin(
        verifiedLeaderboardRunHeads,
        and(
          eq(verifiedLeaderboardRunHeads.playerId, leaderboardRuns.playerId),
          eq(verifiedLeaderboardRunHeads.clientRunId, leaderboardRuns.clientRunId),
        ),
      )
      .where(eq(leaderboardRuns.verificationStatus, "verified"))
      .orderBy(...orderBy)
      .limit(query.limit);

    return rows.map((row) => mapLeaderboardRunRow(row.run));
  }
}

function buildRunKey(playerId: string, clientRunId: string): string {
  return `${playerId}:${clientRunId}`;
}

function buildRunInsert(
  input: CommitVerifiedRunInput,
  runId: string,
  submittedAt?: Date,
): typeof leaderboardRuns.$inferInsert {
  return {
    id: runId,
    playerId: input.run.playerId,
    clientRunId: input.run.clientRunId,
    verificationStatus: input.run.verificationStatus,
    money: input.run.metrics.money,
    cumulativeRevenue: input.run.metrics.cumulativeRevenue,
    totalServers: input.run.metrics.totalServers,
    computeCapacity: input.run.metrics.computeCapacity,
    memoryCapacity: input.run.metrics.memoryCapacity,
    storageCapacity: input.run.metrics.storageCapacity,
    gpuCapacity: input.run.metrics.gpuCapacity,
    gameMonth: input.run.gameMonth,
    submittedAt,
    updatedAt: input.run.updatedAt,
  };
}

function buildHeadInsert(
  input: CommitVerifiedRunInput,
  existingRevision: number,
  createdAt?: Date,
): typeof verifiedLeaderboardRunHeads.$inferInsert {
  const updatedAt = new Date();

  return {
    playerId: input.head.playerId,
    clientRunId: input.head.clientRunId,
    protocolVersion: input.head.protocolVersion,
    rulesetId: input.head.rulesetId,
    genesisSeed: input.head.genesisDescriptor.seed,
    genesisDifficulty: input.head.genesisDescriptor.difficulty,
    rootHash: input.head.rootHash,
    headHash: input.head.headHash,
    stateHash: input.head.stateHash,
    previousHeadHash: input.head.previousHeadHash,
    lastRequestHash: input.head.lastRequestHash,
    gameStateJson: JSON.stringify(input.head.authoritativeState),
    gameMonth: input.head.gameMonth,
    revision: existingRevision + 1,
    createdAt,
    updatedAt,
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

function getMetricValue(run: Pick<LeaderboardRunRecord, "metrics">, metric: LeaderboardQueryMetric): number {
  if (metric === "totalCapacity") {
    return run.metrics.computeCapacity
      + run.metrics.memoryCapacity
      + run.metrics.storageCapacity
      + run.metrics.gpuCapacity;
  }

  return run.metrics[metric];
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
    verificationStatus: row.verificationStatus as LeaderboardRunRecord["verificationStatus"],
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

function mapVerifiedRunHeadRow(
  row: typeof verifiedLeaderboardRunHeads.$inferSelect | undefined,
): VerifiedLeaderboardRunHeadRecord {
  if (!row) {
    throw new Error("Expected verified leaderboard head row to be present.");
  }

  const authoritativeState = JSON.parse(row.gameStateJson) as GameState;

  return {
    playerId: row.playerId,
    clientRunId: row.clientRunId,
    protocolVersion: row.protocolVersion,
    rulesetId: row.rulesetId,
    genesisDescriptor: {
      seed: Number(row.genesisSeed),
      difficulty: row.genesisDifficulty as VerifiedLeaderboardRunHeadRecord["genesisDescriptor"]["difficulty"],
      gameId: row.clientRunId as VerifiedLeaderboardRunHeadRecord["genesisDescriptor"]["gameId"],
      playerName: authoritativeState.player.name,
    },
    rootHash: row.rootHash,
    headHash: row.headHash,
    stateHash: row.stateHash,
    previousHeadHash: row.previousHeadHash,
    lastRequestHash: row.lastRequestHash,
    authoritativeState,
    gameMonth: Number(row.gameMonth),
    revision: Number(row.revision),
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}
