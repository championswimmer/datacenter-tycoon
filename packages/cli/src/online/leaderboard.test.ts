import assert from "node:assert/strict";
import test from "node:test";

import { submitLeaderboardRun, isSubmissionUnavailableError, LeaderboardSubmissionError } from "./leaderboard.js";
import { buildVerifiedCheckpointSubmission, createInitialVerifiedRunState } from "./verified-run.js";
import { newGame, reduce } from "@datacenter-tycoon/game-logic";

test("buildVerifiedCheckpointSubmission emits action-only payloads", () => {
  const state = reduce(newGame(123, { playerName: "Acme Cloud" }), { type: "Tick" });
  const verification = {
    ...createInitialVerifiedRunState(state, { onlineEligible: true }),
    pendingActions: [{ type: "Tick" as const }],
  };

  assert.deepEqual(buildVerifiedCheckpointSubmission("player_abc", verification), {
    playerId: "player_abc",
    clientRunId: state.gameId,
    genesis: {
      seed: state.seed,
      difficulty: state.difficulty,
      rulesetId: "leaderboard-ruleset-v1",
    },
    parentHeadHash: null,
    actions: [{ type: "Tick" }],
  });
});

test("submitLeaderboardRun posts the verified checkpoint payload to the backend", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;

  const submission = {
    playerId: "player_abc",
    clientRunId: "game-123",
    genesis: {
      seed: 42,
      difficulty: "easy" as const,
      rulesetId: "leaderboard-ruleset-v1",
    },
    parentHeadHash: null,
    actions: [{ type: "Tick" as const }],
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
        rootHash: "a".repeat(64),
        headHash: "b".repeat(64),
        gameMonth: 1,
        metrics: {
          money: 1,
          cumulativeRevenue: 2,
          totalServers: 3,
          computeCapacity: 4,
          memoryCapacity: 5,
          storageCapacity: 6,
          gpuCapacity: 7,
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
  assert.equal(result.headHash, "b".repeat(64));
});

test("submitLeaderboardRun surfaces structured API and offline errors", async () => {
  await assert.rejects(
    () => submitLeaderboardRun(
      {
        serverUrl: "https://api.dctycoon.test",
        submission: {
          playerId: "player_abc",
          clientRunId: "game-123",
          genesis: {
            seed: 42,
            difficulty: "easy",
            rulesetId: "leaderboard-ruleset-v1",
          },
          parentHeadHash: null,
          actions: [{ type: "Tick" }],
        },
      },
      async () => new Response(JSON.stringify({
        error: {
          code: "INVALID_VERIFIED_RUN",
          message: "actions may contain at most 512 entries.",
        },
      }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
    ),
    (error: unknown) => {
      assert.ok(error instanceof LeaderboardSubmissionError);
      assert.equal(error.code, "INVALID_VERIFIED_RUN");
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
        genesis: {
          seed: 42,
          difficulty: "easy",
          rulesetId: "leaderboard-ruleset-v1",
        },
        parentHeadHash: null,
        actions: [{ type: "Tick" }],
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
