import assert from "node:assert/strict";
import test from "node:test";

import { newGame } from "@datacenter-tycoon/game-logic";
import {
  buildLeaderboardRunSubmission,
  isSubmissionUnavailableError,
  LeaderboardSubmissionError,
  submitLeaderboardRun,
} from "./leaderboard.js";

test("buildLeaderboardRunSubmission rounds shared metrics to backend-safe integers", () => {
  const state = newGame(123, { playerName: "Acme Cloud" });
  state.tick = 3;
  state.player.cash = 1_500_000.75;
  state.ledger.push({
    id: "ledger-1" as (typeof state.ledger)[number]["id"],
    tick: 1,
    type: "revenue",
    amount: 99.6,
    reason: "contract revenue",
  });

  assert.deepEqual(buildLeaderboardRunSubmission("player_abc", state), {
    playerId: "player_abc",
    clientRunId: state.gameId,
    metrics: {
      money: 1_500_001,
      cumulativeRevenue: 100,
      totalServers: 0,
      computeCapacity: 0,
      memoryCapacity: 0,
      storageCapacity: 0,
      gpuCapacity: 0,
    },
    gameMonth: 3,
  });
});

test("submitLeaderboardRun posts the shared payload to the backend", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;

  const submission = {
    playerId: "player_abc",
    clientRunId: "game-123",
    metrics: {
      money: 1,
      cumulativeRevenue: 2,
      totalServers: 3,
      computeCapacity: 4,
      memoryCapacity: 5,
      storageCapacity: 6,
      gpuCapacity: 7,
    },
    gameMonth: 8,
  };

  const result = await submitLeaderboardRun(
    {
      serverUrl: "https://api.dctycoon.test/",
      submission,
    },
    async (input, init) => {
      requestUrl = String(input);
      requestInit = init;

      return new Response(JSON.stringify({
        created: true,
        run: {
          runId: "run_123",
          playerId: "player_abc",
          clientRunId: "game-123",
          metrics: submission.metrics,
          gameMonth: 8,
          submittedAt: "2026-05-18T12:00:00.000Z",
          updatedAt: "2026-05-18T12:00:00.000Z",
        },
      }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    },
  );

  assert.equal(requestUrl, "https://api.dctycoon.test/leaderboard/runs");
  assert.equal(requestInit?.method, "POST");
  assert.equal(requestInit?.body, JSON.stringify(submission));
  assert.equal(result.created, true);
  assert.equal(result.run.runId, "run_123");
});

test("submitLeaderboardRun surfaces structured API and offline errors", async () => {
  await assert.rejects(
    () => submitLeaderboardRun(
      {
        serverUrl: "https://api.dctycoon.test",
        submission: {
          playerId: "player_abc",
          clientRunId: "game-123",
          metrics: {
            money: -1,
            cumulativeRevenue: 2,
            totalServers: 3,
            computeCapacity: 4,
            memoryCapacity: 5,
            storageCapacity: 6,
            gpuCapacity: 7,
          },
          gameMonth: 8,
        },
      },
      async () => new Response(JSON.stringify({
        error: {
          code: "INVALID_LEADERBOARD_SUBMISSION",
          message: "metrics.money must be non-negative.",
        },
      }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
    ),
    (error: unknown) => {
      assert.ok(error instanceof LeaderboardSubmissionError);
      assert.equal(error.code, "INVALID_LEADERBOARD_SUBMISSION");
      assert.equal(error.status, 400);
      assert.equal(isSubmissionUnavailableError(error), false);
      return true;
    },
  );

  await assert.rejects(
    () => submitLeaderboardRun({
      serverUrl: null,
      submission: {
        playerId: "player_abc",
        clientRunId: "game-123",
        metrics: {
          money: 1,
          cumulativeRevenue: 2,
          totalServers: 3,
          computeCapacity: 4,
          memoryCapacity: 5,
          storageCapacity: 6,
          gpuCapacity: 7,
        },
        gameMonth: 8,
      },
    }),
    (error: unknown) => {
      assert.ok(error instanceof LeaderboardSubmissionError);
      assert.equal(error.code, "ONLINE_SYNC_DISABLED");
      assert.equal(error.status, null);
      assert.equal(isSubmissionUnavailableError(error), true);
      return true;
    },
  );
});
