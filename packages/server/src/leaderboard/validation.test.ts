import assert from "node:assert/strict";
import { test } from "node:test";
import { parseLeaderboardRunSubmission } from "./validation.js";
import { LeaderboardValidationError } from "./types.js";

test("parseLeaderboardRunSubmission rejects missing metric fields", () => {
  assert.throws(
    () =>
      parseLeaderboardRunSubmission({
        playerId: "player_123",
        clientRunId: "run-1",
        metrics: {
          money: 1,
          cumulativeRevenue: 1,
          totalServers: 1,
          computeCapacity: 1,
          memoryCapacity: 1,
          storageCapacity: 1,
        },
        gameMonth: 1,
      }),
    (error: unknown) => {
      assert.ok(error instanceof LeaderboardValidationError);
      assert.match(error.message, /metrics\.gpuCapacity/);
      return true;
    },
  );
});

test("parseLeaderboardRunSubmission rejects unknown metric keys", () => {
  assert.throws(
    () =>
      parseLeaderboardRunSubmission({
        playerId: "player_123",
        clientRunId: "run-2",
        metrics: {
          money: 1,
          cumulativeRevenue: 1,
          totalServers: 1,
          computeCapacity: 1,
          memoryCapacity: 1,
          storageCapacity: 1,
          gpuCapacity: 1,
          totalCapacity: 4,
        },
        gameMonth: 1,
      }),
    (error: unknown) => {
      assert.ok(error instanceof LeaderboardValidationError);
      assert.match(error.message, /unsupported keys: totalCapacity/);
      return true;
    },
  );
});
