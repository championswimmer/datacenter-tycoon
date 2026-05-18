import assert from "node:assert/strict";
import { test } from "node:test";
import type { RegisterPlayerInput } from "../players/repository.js";
import { InMemoryPlayersRepository, type PlayersRepository } from "../players/repository.js";
import {
  InMemoryLeaderboardRepository,
  type LeaderboardRepository,
} from "../leaderboard/repository.js";
import { apiRequest, createTestApp } from "../test-utils/app.js";

async function registerPlayer(app: ReturnType<typeof createTestApp>["app"]) {
  const response = await apiRequest<{ playerId: string; username: string }>(app, "/players", {
    method: "POST",
    body: JSON.stringify({ username: "Acme Cloud" }),
    headers: { "content-type": "application/json" },
  });

  return response.json;
}

function createLeaderboardApp(options?: {
  players?: PlayersRepository;
  leaderboard?: LeaderboardRepository;
}) {
  return createTestApp({
    services: {
      players: options?.players ?? new InMemoryPlayersRepository(),
      leaderboard: options?.leaderboard ?? new InMemoryLeaderboardRepository(),
    },
  });
}

test("POST /leaderboard/runs stores a run summary", async () => {
  const { app } = createLeaderboardApp();
  const player = await registerPlayer(app);
  const { response, json } = await apiRequest<{
    created: boolean;
    run: {
      runId: string;
      playerId: string;
      clientRunId: string;
      metrics: { money: number; cumulativeRevenue: number; totalServers: number };
      gameMonth: number;
      submittedAt: string;
      updatedAt: string;
    };
  }>(app, "/leaderboard/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      playerId: player?.playerId,
      clientRunId: "run-001",
      metrics: {
        money: 1_250_000,
        cumulativeRevenue: 2_750_000,
        totalServers: 12,
        computeCapacity: 160,
        memoryCapacity: 2048,
        storageCapacity: 800,
        gpuCapacity: 24,
      },
      gameMonth: 18,
    }),
  });

  assert.equal(response.status, 201);
  assert.equal(json?.created, true);
  assert.match(json?.run.runId ?? "", /^run_[a-f0-9]{32}$/);
  assert.equal(json?.run.playerId, player?.playerId);
  assert.equal(json?.run.clientRunId, "run-001");
  assert.equal(json?.run.metrics.money, 1_250_000);
  assert.equal(json?.run.gameMonth, 18);
});

test("POST /leaderboard/runs is idempotent for duplicate client run ids", async () => {
  const { app } = createLeaderboardApp();
  const player = await registerPlayer(app);
  const payload = {
    playerId: player?.playerId,
    clientRunId: "run-duplicate",
    metrics: {
      money: 900_000,
      cumulativeRevenue: 1_100_000,
      totalServers: 8,
      computeCapacity: 80,
      memoryCapacity: 512,
      storageCapacity: 256,
      gpuCapacity: 0,
    },
    gameMonth: 11,
  };

  const first = await apiRequest<{ created: boolean; run: { runId: string } }>(app, "/leaderboard/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const second = await apiRequest<{ created: boolean; run: { runId: string } }>(app, "/leaderboard/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  assert.equal(first.response.status, 201);
  assert.equal(second.response.status, 200);
  assert.equal(first.json?.created, true);
  assert.equal(second.json?.created, false);
  assert.equal(first.json?.run.runId, second.json?.run.runId);
});

test("POST /leaderboard/runs rejects unknown player ids", async () => {
  const { app } = createLeaderboardApp();
  const { response, json } = await apiRequest<{
    error: { code: string; message: string };
  }>(app, "/leaderboard/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      playerId: "player_missing",
      clientRunId: "run-404",
      metrics: {
        money: 1,
        cumulativeRevenue: 1,
        totalServers: 1,
        computeCapacity: 1,
        memoryCapacity: 1,
        storageCapacity: 1,
        gpuCapacity: 1,
      },
      gameMonth: 1,
    }),
  });

  assert.equal(response.status, 404);
  assert.equal(json?.error.code, "PLAYER_NOT_FOUND");
});

test("POST /leaderboard/runs rejects invalid metric payloads", async () => {
  const { app } = createLeaderboardApp();
  const player = await registerPlayer(app);
  const { response, json } = await apiRequest<{
    error: { code: string; message: string };
  }>(app, "/leaderboard/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      playerId: player?.playerId,
      clientRunId: "run-invalid",
      metrics: {
        money: -1,
        cumulativeRevenue: 1,
        totalServers: 1,
        computeCapacity: 1,
        memoryCapacity: 1,
        storageCapacity: 1,
        gpuCapacity: 1,
      },
      gameMonth: 1,
    }),
  });

  assert.equal(response.status, 400);
  assert.equal(json?.error.code, "INVALID_LEADERBOARD_SUBMISSION");
});

test("POST /leaderboard/runs rejects conflicting retries for the same client run id", async () => {
  const { app } = createLeaderboardApp();
  const player = await registerPlayer(app);

  await apiRequest(app, "/leaderboard/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      playerId: player?.playerId,
      clientRunId: "run-conflict",
      metrics: {
        money: 10,
        cumulativeRevenue: 10,
        totalServers: 1,
        computeCapacity: 10,
        memoryCapacity: 10,
        storageCapacity: 10,
        gpuCapacity: 0,
      },
      gameMonth: 1,
    }),
  });

  const { response, json } = await apiRequest<{
    error: { code: string; message: string };
  }>(app, "/leaderboard/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      playerId: player?.playerId,
      clientRunId: "run-conflict",
      metrics: {
        money: 999,
        cumulativeRevenue: 10,
        totalServers: 1,
        computeCapacity: 10,
        memoryCapacity: 10,
        storageCapacity: 10,
        gpuCapacity: 0,
      },
      gameMonth: 1,
    }),
  });

  assert.equal(response.status, 409);
  assert.equal(json?.error.code, "CLIENT_RUN_CONFLICT");
});

test("POST /leaderboard/runs surfaces database failures as internal errors", async () => {
  class BrokenLeaderboardRepository implements LeaderboardRepository {
    async upsertRun(): Promise<never> {
      throw new Error("database unavailable");
    }
  }

  const players = new InMemoryPlayersRepository();
  const createdPlayer = await players.createPlayer({ username: "Acme Cloud" });
  const { app } = createLeaderboardApp({
    players,
    leaderboard: new BrokenLeaderboardRepository(),
  });
  const { response, json } = await apiRequest<{
    error: { code: string; message: string };
  }>(app, "/leaderboard/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      playerId: createdPlayer.playerId,
      clientRunId: "run-broken",
      metrics: {
        money: 1,
        cumulativeRevenue: 1,
        totalServers: 1,
        computeCapacity: 1,
        memoryCapacity: 1,
        storageCapacity: 1,
        gpuCapacity: 1,
      },
      gameMonth: 1,
    }),
  });

  assert.equal(response.status, 500);
  assert.equal(json?.error.code, "INTERNAL_SERVER_ERROR");
  assert.match(json?.error.message ?? "", /database unavailable/);
});

test("service-level register input types remain usable in fake repositories", async () => {
  const sampleInput: RegisterPlayerInput = {
    username: "Acme Cloud",
  };

  assert.equal(sampleInput.username, "Acme Cloud");
});
