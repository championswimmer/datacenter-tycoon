import assert from "node:assert/strict";
import { test } from "bun:test";
import { getTableColumns, getTableName } from "drizzle-orm";
import { leaderboardRuns, players } from "./schema.js";

test("Drizzle schema models the existing leaderboard tables", () => {
  assert.equal(getTableName(players), "players");
  assert.equal(getTableName(leaderboardRuns), "leaderboard_runs");

  const playerColumns = Object.keys(getTableColumns(players)).sort();
  const leaderboardColumns = Object.keys(getTableColumns(leaderboardRuns)).sort();

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
  ]);
});
