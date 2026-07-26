import assert from "node:assert/strict";
import test from "node:test";

import { newGame } from "@datacenter-tycoon/game-logic";

import { parseArgv } from "../argv.js";
import type { CommandClient } from "../commands/common.js";
import { createInitialVerifiedRunState } from "./verified-run.js";
import { syncLeaderboardFromCommand } from "./sync.js";

function createSnapshotClient(snapshot = newGame(1)): Pick<CommandClient, "query" | "control"> {
  const verification = createInitialVerifiedRunState(snapshot, { onlineEligible: true });
  const controlCalls: Array<unknown> = [];

  return {
    query: async (params) => {
      if (params.kind === "verification") {
        return verification;
      }
      return snapshot;
    },
    control: async (params) => {
      controlCalls.push(params);
      if (params.op === "set-verification") {
        Object.assign(verification, params.verification);
      }
      return { ok: true };
    },
  };
}

test("syncLeaderboardFromCommand skips runs that have not progressed yet", async () => {
  const snapshot = newGame(1);
  snapshot.tick = 0;

  let submitted = false;
  const result = await syncLeaderboardFromCommand(
    parseArgv(["tick", "1", "--server", "https://api.dctycoon.test"]),
    createSnapshotClient(snapshot),
    {
      onlineProfilePath: "/tmp/dct-config/online-profile.json",
    },
    {
      readProfile: async () => ({
        serverUrl: "https://api.dctycoon.test",
        playerId: "player_123",
        username: "Acme Cloud",
      }),
      submitRun: async () => {
        submitted = true;
        throw new Error("should not submit");
      },
    },
  );

  assert.equal(result.status, "skipped");
  assert.equal(result.reason, "not_progressed");
  assert.equal(submitted, false);
});

test("syncLeaderboardFromCommand submits pending verified actions and then skips fully acknowledged runs", async () => {
  const snapshot = newGame(2);
  snapshot.gameId = "game-duplicate";
  snapshot.tick = 2;
  const client = createSnapshotClient(snapshot);
  const verification = await client.query({ kind: "verification" });
  Object.assign(verification as object, {
    pendingActions: [{ type: "Tick" }],
    status: "pending-genesis",
  });

  let submitCount = 0;
  const dependencies = {
    readProfile: async () => ({
      serverUrl: "https://api.dctycoon.test",
      playerId: "player_123",
      username: "Acme Cloud",
    }),
    submitRun: async () => {
      submitCount += 1;
      return {
        created: true,
        rootHash: "a".repeat(64),
        headHash: "b".repeat(64),
        gameMonth: 2,
        metrics: {
          money: snapshot.player.cash,
          cumulativeRevenue: 0,
          totalServers: 0,
          computeCapacity: 0,
          memoryCapacity: 0,
          storageCapacity: 0,
          gpuCapacity: 0,
        },
      };
    },
  };

  const first = await syncLeaderboardFromCommand(
    parseArgv(["tick", "1", "--server", "https://api.dctycoon.test"]),
    client,
    {
      onlineProfilePath: "/tmp/dct-config/online-profile.json",
    },
    dependencies,
  );
  const second = await syncLeaderboardFromCommand(
    parseArgv(["tick", "1", "--server", "https://api.dctycoon.test"]),
    client,
    {
      onlineProfilePath: "/tmp/dct-config/online-profile.json",
    },
    dependencies,
  );

  assert.equal(first.status, "submitted");
  assert.equal(second.status, "skipped");
  assert.equal(second.reason, "already_verified");
  assert.equal(submitCount, 1);
});
