import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_LEADERBOARD_GAME_MONTH,
  assertMonotonicRunUpdate,
  parseLeaderboardRunSubmission,
} from "./validation.js";
import {
  createLeaderboardRunRecord,
  LeaderboardRunRegressionError,
  LeaderboardValidationError,
} from "./types.js";

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

test("parseLeaderboardRunSubmission rejects impossible-looking game months", () => {
  assert.throws(
    () =>
      parseLeaderboardRunSubmission({
        playerId: "player_123",
        clientRunId: "run-3",
        metrics: {
          money: 1,
          cumulativeRevenue: 1,
          totalServers: 1,
          computeCapacity: 1,
          memoryCapacity: 1,
          storageCapacity: 1,
          gpuCapacity: 1,
        },
        gameMonth: MAX_LEADERBOARD_GAME_MONTH + 1,
      }),
    (error: unknown) => {
      assert.ok(error instanceof LeaderboardValidationError);
      assert.match(error.message, new RegExp(String(MAX_LEADERBOARD_GAME_MONTH)));
      return true;
    },
  );
});

test("assertMonotonicRunUpdate rejects game-month or cumulative-revenue regressions", () => {
  const existingRun = createLeaderboardRunRecord({
    runId: "run_123",
    playerId: "player_123",
    clientRunId: "client-run-1",
    metrics: {
      money: 100,
      cumulativeRevenue: 200,
      totalServers: 3,
      computeCapacity: 10,
      memoryCapacity: 20,
      storageCapacity: 30,
      gpuCapacity: 0,
    },
    gameMonth: 6,
    submittedAt: new Date("2026-05-18T12:00:00.000Z"),
  });

  assert.throws(
    () =>
      assertMonotonicRunUpdate(existingRun, {
        playerId: existingRun.playerId,
        clientRunId: existingRun.clientRunId,
        metrics: {
          ...existingRun.metrics,
          money: 90,
        },
        gameMonth: 5,
      }),
    (error: unknown) => {
      assert.ok(error instanceof LeaderboardRunRegressionError);
      assert.match(error.message, /gameMonth 5/);
      return true;
    },
  );

  assert.throws(
    () =>
      assertMonotonicRunUpdate(existingRun, {
        playerId: existingRun.playerId,
        clientRunId: existingRun.clientRunId,
        metrics: {
          ...existingRun.metrics,
          cumulativeRevenue: 199,
        },
        gameMonth: 6,
      }),
    (error: unknown) => {
      assert.ok(error instanceof LeaderboardRunRegressionError);
      assert.match(error.message, /cumulativeRevenue 199/);
      return true;
    },
  );
});
