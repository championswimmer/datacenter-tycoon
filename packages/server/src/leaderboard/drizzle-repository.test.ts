import assert from "node:assert/strict";
import { test } from "bun:test";
import { createMigratedPgliteDatabase } from "../db/test-database.js";
import { DrizzlePlayersRepository } from "../players/drizzle-repository.js";
import { DrizzleLeaderboardRepository } from "./repository.js";

test("DrizzleLeaderboardRepository upserts idempotently and orders runs by metric", async () => {
  const database = await createMigratedPgliteDatabase();
  const players = new DrizzlePlayersRepository(database.db);
  const leaderboard = new DrizzleLeaderboardRepository(database.db);
  const alpha = await players.createPlayer({ username: "Alpha Cloud" });
  const beta = await players.createPlayer({ username: "Beta Cloud" });

  const first = await leaderboard.upsertRun({
    playerId: alpha.playerId,
    clientRunId: "run-alpha",
    metrics: {
      money: 10,
      cumulativeRevenue: 20,
      totalServers: 1,
      computeCapacity: 100,
      memoryCapacity: 200,
      storageCapacity: 300,
      gpuCapacity: 0,
    },
    gameMonth: 3,
  });
  assert.equal(first.created, true);

  const replay = await leaderboard.upsertRun({
    playerId: alpha.playerId,
    clientRunId: "run-alpha",
    metrics: {
      money: 10,
      cumulativeRevenue: 20,
      totalServers: 1,
      computeCapacity: 100,
      memoryCapacity: 200,
      storageCapacity: 300,
      gpuCapacity: 0,
    },
    gameMonth: 3,
  });
  assert.equal(replay.created, false);
  assert.equal(replay.run.runId, first.run.runId);

  await leaderboard.upsertRun({
    playerId: beta.playerId,
    clientRunId: "run-beta",
    metrics: {
      money: 25,
      cumulativeRevenue: 50,
      totalServers: 2,
      computeCapacity: 10,
      memoryCapacity: 10,
      storageCapacity: 10,
      gpuCapacity: 10,
    },
    gameMonth: 4,
  });

  const moneyRuns = await leaderboard.listRuns({
    metric: "money",
    period: "all-time",
    limit: 5,
  });
  assert.deepEqual(
    moneyRuns.map((run) => [run.playerId, run.metrics.money]),
    [
      [beta.playerId, 25],
      [alpha.playerId, 10],
    ],
  );

  const totalCapacityRuns = await leaderboard.listRuns({
    metric: "totalCapacity",
    period: "all-time",
    limit: 5,
  });
  assert.deepEqual(
    totalCapacityRuns.map((run) => [run.playerId, run.metrics.computeCapacity + run.metrics.memoryCapacity + run.metrics.storageCapacity + run.metrics.gpuCapacity]),
    [
      [alpha.playerId, 600],
      [beta.playerId, 40],
    ],
  );

  await database.close();
});
