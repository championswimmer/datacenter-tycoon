import assert from "node:assert/strict";
import { test } from "bun:test";
import {
  parseVerifiedRunCheckpointSubmission,
} from "./validation.js";
import { LeaderboardValidationError } from "./types.js";

test("parseVerifiedRunCheckpointSubmission parses a valid genesis checkpoint", () => {
  const submission = parseVerifiedRunCheckpointSubmission({
    playerId: "player_123",
    clientRunId: "run-1",
    genesis: {
      seed: 42,
      difficulty: "easy",
      rulesetId: "leaderboard-ruleset-v1",
    },
    parentHeadHash: null,
    actions: [
      { type: "BuildDatacenter", specId: "garage", dcId: "dc-1", regionId: "region-1" },
      { type: "Tick" },
    ],
  });

  assert.equal(submission.clientRunId, "run-1");
  assert.equal(submission.genesis?.seed, 42);
  assert.equal(submission.parentHeadHash, null);
  assert.equal(submission.actions.length, 2);
});

test("parseVerifiedRunCheckpointSubmission rejects legacy summary fields", () => {
  assert.throws(
    () =>
      parseVerifiedRunCheckpointSubmission({
        playerId: "player_123",
        clientRunId: "run-2",
        parentHeadHash: null,
        actions: [],
        metrics: { money: 1 },
        gameMonth: 1,
      }),
    (error: unknown) => {
      assert.ok(error instanceof LeaderboardValidationError);
      assert.match(error.message, /Unsupported field\(s\): metrics, gameMonth/);
      return true;
    },
  );
});

test("parseVerifiedRunCheckpointSubmission rejects unsupported action types", () => {
  assert.throws(
    () =>
      parseVerifiedRunCheckpointSubmission({
        playerId: "player_123",
        clientRunId: "run-3",
        parentHeadHash: null,
        actions: [{ type: "SetPaused", paused: true }],
      }),
    (error: unknown) => {
      assert.ok(error instanceof LeaderboardValidationError);
      assert.match(error.message, /unsupported/i);
      return true;
    },
  );
});

test("parseVerifiedRunCheckpointSubmission rejects malformed parent hashes", () => {
  assert.throws(
    () =>
      parseVerifiedRunCheckpointSubmission({
        playerId: "player_123",
        clientRunId: "run-4",
        parentHeadHash: "abc",
        actions: [],
      }),
    (error: unknown) => {
      assert.ok(error instanceof LeaderboardValidationError);
      assert.match(error.message, /parentHeadHash/);
      return true;
    },
  );
});

test("parseVerifiedRunCheckpointSubmission rejects extra action fields", () => {
  assert.throws(
    () =>
      parseVerifiedRunCheckpointSubmission({
        playerId: "player_123",
        clientRunId: "run-5",
        parentHeadHash: null,
        actions: [{ type: "Tick", bogus: true }],
      }),
    (error: unknown) => {
      assert.ok(error instanceof LeaderboardValidationError);
      assert.match(error.message, /Unsupported field/);
      return true;
    },
  );
});
