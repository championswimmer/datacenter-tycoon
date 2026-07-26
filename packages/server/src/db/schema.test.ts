import assert from "node:assert/strict";
import { test } from "bun:test";
import { getTableColumns, getTableName } from "drizzle-orm";
import { leaderboardRuns, players, verifiedLeaderboardRunHeads } from "./schema.js";

test("Drizzle schema models the leaderboard and verified-head tables", () => {
  assert.equal(getTableName(players), "players");
  assert.equal(getTableName(leaderboardRuns), "leaderboard_runs");
  assert.equal(getTableName(verifiedLeaderboardRunHeads), "verified_leaderboard_run_heads");

  const playerColumns = Object.keys(getTableColumns(players)).sort();
  const leaderboardColumns = Object.keys(getTableColumns(leaderboardRuns)).sort();
  const headColumns = Object.keys(getTableColumns(verifiedLeaderboardRunHeads)).sort();

  assert.deepEqual(playerColumns, [
    "createdAt",
    "id",
    "lastSeenAt",
    "normalizedUsername",
    "username",
  ]);

  assert.deepEqual(leaderboardColumns, [
    "clientRunId",
    "computeCapacity",
    "cumulativeRevenue",
    "gameMonth",
    "gpuCapacity",
    "id",
    "memoryCapacity",
    "money",
    "playerId",
    "storageCapacity",
    "submittedAt",
    "totalServers",
    "updatedAt",
    "verificationStatus",
  ]);

  assert.deepEqual(headColumns, [
    "clientRunId",
    "createdAt",
    "gameMonth",
    "gameStateJson",
    "genesisDifficulty",
    "genesisSeed",
    "headHash",
    "lastRequestHash",
    "playerId",
    "previousHeadHash",
    "protocolVersion",
    "revision",
    "rootHash",
    "rulesetId",
    "stateHash",
    "updatedAt",
  ]);
});
