import assert from "node:assert/strict";
import { test } from "bun:test";
import { createVerifiedGenesisState } from "@datacenter-tycoon/game-logic";
import { createMigratedPgliteDatabase } from "../db/test-database.js";
import { leaderboardRuns } from "../db/schema.js";
import { DrizzlePlayersRepository } from "../players/drizzle-repository.js";
import { DrizzleLeaderboardRepository } from "./repository.js";
import { createLeaderboardRunRecord } from "./types.js";

test("DrizzleLeaderboardRepository commits verified heads and lists only verified runs", async () => {
  const database = await createMigratedPgliteDatabase();
  const players = new DrizzlePlayersRepository(database);
  const leaderboard = new DrizzleLeaderboardRepository(database);
  const alpha = await players.createPlayer({ username: "Alpha Cloud" });
  const beta = await players.createPlayer({ username: "Beta Cloud" });
  const gamma = await players.createPlayer({ username: "Gamma Cloud" });
  const now = new Date("2026-07-26T12:00:00.000Z");

  const committed = await leaderboard.commitVerifiedRun({
    expectedParentHeadHash: null,
    run: createLeaderboardRunRecord({
      runId: "placeholder",
      playerId: alpha.playerId,
      clientRunId: "run-alpha",
      verificationStatus: "verified",
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
      updatedAt: now,
    }),
    head: {
      playerId: alpha.playerId,
      clientRunId: "run-alpha",
      protocolVersion: "verified-run-v1",
      rulesetId: "leaderboard-ruleset-v1",
      genesisDescriptor: {
        seed: 42,
        difficulty: "easy",
        gameId: "run-alpha" as never,
        playerName: "Alpha Cloud",
      },
      rootHash: "a".repeat(64),
      headHash: "b".repeat(64),
      stateHash: "c".repeat(64),
      previousHeadHash: null,
      lastRequestHash: "d".repeat(64),
      authoritativeState: createVerifiedGenesisState({
        seed: 42,
        difficulty: "easy",
        gameId: "run-alpha" as never,
        playerName: "Alpha Cloud",
      }),
      gameMonth: 3,
    },
  });

  assert.equal(committed.created, true);
  assert.equal(committed.run.verificationStatus, "verified");
  assert.equal((await leaderboard.findRunHead(alpha.playerId, "run-alpha"))?.headHash, "b".repeat(64));

  await database.db.insert(leaderboardRuns).values({
    id: "legacy-run",
    playerId: beta.playerId,
    clientRunId: "run-beta",
    verificationStatus: "unverified",
    money: 99,
    cumulativeRevenue: 99,
    totalServers: 9,
    computeCapacity: 9,
    memoryCapacity: 9,
    storageCapacity: 9,
    gpuCapacity: 9,
    gameMonth: 9,
  });

  await leaderboard.commitVerifiedRun({
    expectedParentHeadHash: null,
    run: createLeaderboardRunRecord({
      runId: "placeholder-2",
      playerId: gamma.playerId,
      clientRunId: "run-gamma",
      verificationStatus: "verified",
      metrics: {
        money: 999,
        cumulativeRevenue: 0,
        totalServers: 99,
        computeCapacity: 999,
        memoryCapacity: 999,
        storageCapacity: 999,
        gpuCapacity: 0,
      },
      gameMonth: 6,
      updatedAt: now,
    }),
    head: {
      playerId: gamma.playerId,
      clientRunId: "run-gamma",
      protocolVersion: "verified-run-v1",
      rulesetId: "leaderboard-ruleset-v1",
      genesisDescriptor: {
        seed: 84,
        difficulty: "easy",
        gameId: "run-gamma" as never,
        playerName: "Gamma Cloud",
      },
      rootHash: "d".repeat(64),
      headHash: "e".repeat(64),
      stateHash: "f".repeat(64),
      previousHeadHash: null,
      lastRequestHash: "1".repeat(64),
      authoritativeState: createVerifiedGenesisState({
        seed: 84,
        difficulty: "easy",
        gameId: "run-gamma" as never,
        playerName: "Gamma Cloud",
      }),
      gameMonth: 6,
    },
  });

  const listed = await leaderboard.listRuns({
    metric: "money",
    period: "all-time",
    limit: 5,
    visibility: "verified",
  });
  const allListed = await leaderboard.listRuns({
    metric: "money",
    period: "all-time",
    limit: 5,
    visibility: "all",
  });

  assert.deepEqual(listed.map((run) => [run.playerId, run.verificationStatus]), [
    [alpha.playerId, "verified"],
  ]);
  assert.deepEqual(allListed.map((run) => [run.playerId, run.verificationStatus]), [
    [beta.playerId, "unverified"],
    [alpha.playerId, "verified"],
  ]);
  assert.ok(listed.every((run) => run.metrics.cumulativeRevenue > 0));
  assert.ok(allListed.every((run) => run.metrics.cumulativeRevenue > 0));

  await database.close();
});
