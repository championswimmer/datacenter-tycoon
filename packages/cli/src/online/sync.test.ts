import assert from "node:assert/strict";
import test from "node:test";

import { newGame } from "@datacenter-tycoon/game-logic";

import { parseArgv } from "../argv.js";
import type { CommandClient } from "../commands/common.js";
import { syncLeaderboardFromCommand } from "./sync.js";

function createSnapshotClient(snapshot = newGame(1)): Pick<CommandClient, "query"> {
  return {
    query: async () => snapshot,
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
      configDir: "/tmp/dct-config",
      onlineProfilePath: "/tmp/dct-config/online-profile.json",
    },
    {
      readProfile: async () => ({
        serverUrl: "https://api.dctycoon.test",
        playerId: "player_123",
        username: "Acme Cloud",
      }),
      readSyncState: async () => ({ signaturesByRunKey: {} }),
      writeSyncState: async () => undefined,
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

test("syncLeaderboardFromCommand persists a signature and skips duplicate submissions", async () => {
  const snapshot = newGame(2);
  snapshot.gameId = "game-duplicate";
  snapshot.tick = 2;

  let submitCount = 0;
  let syncState = { signaturesByRunKey: {} as Record<string, string> };

  const dependencies = {
    readProfile: async () => ({
      serverUrl: "https://api.dctycoon.test",
      playerId: "player_123",
      username: "Acme Cloud",
    }),
    readSyncState: async () => syncState,
    writeSyncState: async (_path: string, nextState: { signaturesByRunKey: Record<string, string> }) => {
      syncState = nextState;
    },
    submitRun: async () => {
      submitCount += 1;
      return {
        created: true,
        run: {
          runId: "run_123",
          playerId: "player_123",
          clientRunId: "game-duplicate",
          metrics: {
            money: snapshot.player.cash,
            cumulativeRevenue: 0,
            totalServers: 0,
            computeCapacity: 0,
            memoryCapacity: 0,
            storageCapacity: 0,
            gpuCapacity: 0,
          },
          gameMonth: 2,
          submittedAt: "2026-05-29T00:00:00.000Z",
          updatedAt: "2026-05-29T00:00:00.000Z",
        },
      };
    },
  };

  const first = await syncLeaderboardFromCommand(
    parseArgv(["tick", "1", "--server", "https://api.dctycoon.test"]),
    createSnapshotClient(snapshot),
    {
      configDir: "/tmp/dct-config",
      onlineProfilePath: "/tmp/dct-config/online-profile.json",
    },
    dependencies,
  );
  const second = await syncLeaderboardFromCommand(
    parseArgv(["tick", "1", "--server", "https://api.dctycoon.test"]),
    createSnapshotClient(snapshot),
    {
      configDir: "/tmp/dct-config",
      onlineProfilePath: "/tmp/dct-config/online-profile.json",
    },
    dependencies,
  );

  assert.equal(first.status, "submitted");
  assert.equal(second.status, "skipped");
  assert.equal(second.reason, "duplicate_signature");
  assert.equal(submitCount, 1);
});
