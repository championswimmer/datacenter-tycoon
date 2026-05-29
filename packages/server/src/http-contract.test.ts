import assert from "node:assert/strict";
import { test } from "bun:test";
import {
  InMemoryLeaderboardRepository,
  type LeaderboardRepository,
} from "./leaderboard/repository.js";
import {
  InMemoryPlayersRepository,
  type PlayersRepository,
} from "./players/repository.js";
import type { RateLimiter, RateLimitRule } from "./rate-limit/fixed-window.js";
import {
  frozenEndpointContracts,
  internalImplementationDetailsFreeToChange,
  stableTransportContractDetails,
} from "./test-utils/contracts.js";
import { apiRequest, createTestApp } from "./test-utils/app.js";

function assertJsonContentType(response: Response): void {
  assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
}

function assertCurrentCorsBehavior(response: Response): void {
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.equal(response.headers.get("access-control-allow-credentials"), null);
}

async function registerPlayer(app: ReturnType<typeof createTestApp>["app"]) {
  const result = await apiRequest<{ playerId: string; username: string }>(app, "/players", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "Acme Cloud" }),
  });

  assert.equal(result.response.status, frozenEndpointContracts.registerPlayer.successStatus);
  return result.json;
}

function createContractTestApp(options?: {
  players?: PlayersRepository;
  leaderboard?: LeaderboardRepository;
  rateLimiter?: RateLimiter;
}) {
  return createTestApp({
    services: {
      players: options?.players ?? new InMemoryPlayersRepository(),
      leaderboard: options?.leaderboard ?? new InMemoryLeaderboardRepository(),
      rateLimiter: options?.rateLimiter,
    },
  });
}

test("frozen server contract notes capture stable transport details and migration freedom", () => {
  assert.deepEqual(
    Object.values(frozenEndpointContracts).map((contract) => contract.path),
    [
      "/healthz",
      "/version",
      "/players/availability",
      "/players",
      "/leaderboard",
      "/leaderboard/runs",
    ],
  );
  assert.ok(stableTransportContractDetails.some((detail) => detail.includes("absence of CORS response headers")));
  assert.ok(
    internalImplementationDetailsFreeToChange.some((detail) => detail.includes("Elysia + Bun runtime")),
  );
  assert.ok(
    internalImplementationDetailsFreeToChange.some((detail) => detail.includes("Drizzle repositories")),
  );
});

test("GET /healthz preserves its status code, body shape, content type, and current CORS behavior", async () => {
  const { app } = createContractTestApp();
  const { response, json } = await apiRequest<{
    status: string;
    environment: string;
    databaseConfigured: boolean;
  }>(app, frozenEndpointContracts.healthz.path);

  assert.equal(response.status, frozenEndpointContracts.healthz.successStatus);
  assertJsonContentType(response);
  assertCurrentCorsBehavior(response);
  assert.deepEqual(json, {
    status: "ok",
    environment: "test",
    databaseConfigured: false,
  });
});

test("GET /version preserves its status code and JSON payload shape", async () => {
  const { app } = createContractTestApp();
  const { response, json } = await apiRequest<{
    serverVersion: string;
    gameLogicVersion: string;
  }>(app, frozenEndpointContracts.version.path);

  assert.equal(response.status, frozenEndpointContracts.version.successStatus);
  assertJsonContentType(response);
  assert.deepEqual(Object.keys(json ?? {}).sort(), ["gameLogicVersion", "serverVersion"]);
  assert.equal(json?.serverVersion, "9.9.9-test");
  assert.match(json?.gameLogicVersion ?? "", /^\d+\.\d+\.\d+/);
});

test("GET /players/availability preserves the success payload contract", async () => {
  const { app } = createContractTestApp();
  const { response, json } = await apiRequest<{
    username: string;
    available: boolean;
  }>(app, "/players/availability?username=Acme%20Cloud");

  assert.equal(response.status, frozenEndpointContracts.playerAvailability.successStatus);
  assertJsonContentType(response);
  assert.deepEqual(json, {
    username: "Acme Cloud",
    available: true,
  });
});

test("POST /players preserves INVALID_JSON error semantics for malformed request bodies", async () => {
  const { app } = createContractTestApp();
  const { response, json } = await apiRequest<{
    error: { code: string; message: string };
  }>(app, frozenEndpointContracts.registerPlayer.path, {
    method: frozenEndpointContracts.registerPlayer.method,
    headers: { "content-type": "application/json" },
    body: "not-json",
  });

  assert.equal(response.status, 400);
  assertJsonContentType(response);
  assertCurrentCorsBehavior(response);
  assert.equal(json?.error.code, "INVALID_JSON");
  assert.equal(json?.error.message, "Request body must be valid JSON.");
  assert.equal(response.headers.get("retry-after"), null);
});

test("POST /players preserves success and duplicate-username contracts", async () => {
  const { app } = createContractTestApp();
  const created = await apiRequest<{ playerId: string; username: string }>(app, "/players", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "  Acme Cloud  " }),
  });

  assert.equal(created.response.status, frozenEndpointContracts.registerPlayer.successStatus);
  assertJsonContentType(created.response);
  assert.equal(created.json?.username, "Acme Cloud");
  assert.match(created.json?.playerId ?? "", /^player_[a-f0-9]{32}$/);

  const duplicate = await apiRequest<{ error: { code: string; message: string } }>(app, "/players", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "acme cloud" }),
  });

  assert.equal(duplicate.response.status, 409);
  assert.equal(duplicate.json?.error.code, "USERNAME_UNAVAILABLE");
  assert.match(duplicate.json?.error.message ?? "", /already taken/i);
});

test("GET /leaderboard preserves query-validation and response-envelope behavior", async () => {
  const fixedSubmittedAt = new Date("2026-05-29T12:00:00.000Z");
  const players = new InMemoryPlayersRepository();
  const leaderboard = new InMemoryLeaderboardRepository(() => fixedSubmittedAt);
  const alpha = await players.createPlayer({ username: "Alpha Cloud" });
  const beta = await players.createPlayer({ username: "Beta Cloud" });

  await leaderboard.upsertRun({
    playerId: alpha.playerId,
    clientRunId: "run-alpha",
    metrics: {
      money: 1200,
      cumulativeRevenue: 2200,
      totalServers: 10,
      computeCapacity: 40,
      memoryCapacity: 400,
      storageCapacity: 800,
      gpuCapacity: 0,
    },
    gameMonth: 12,
  });
  await leaderboard.upsertRun({
    playerId: beta.playerId,
    clientRunId: "run-beta",
    metrics: {
      money: 900,
      cumulativeRevenue: 1900,
      totalServers: 9,
      computeCapacity: 30,
      memoryCapacity: 300,
      storageCapacity: 700,
      gpuCapacity: 0,
    },
    gameMonth: 11,
  });

  const { app } = createContractTestApp({ players, leaderboard });
  const listed = await apiRequest<{
    metric: string;
    period: string;
    limit: number;
    entries: Array<{
      rank: number;
      playerId: string;
      username: string;
      metric: string;
      value: number;
      submittedAt: string;
      gameMonth: number;
      metrics: { money: number; cumulativeRevenue: number; totalServers: number };
    }>;
  }>(app, "/leaderboard?metric=money&period=all-time&limit=2");

  assert.equal(listed.response.status, frozenEndpointContracts.leaderboard.successStatus);
  assertJsonContentType(listed.response);
  assert.deepEqual(listed.json, {
    metric: "money",
    period: "all-time",
    limit: 2,
    entries: [
      {
        rank: 1,
        playerId: alpha.playerId,
        username: "Alpha Cloud",
        metric: "money",
        value: 1200,
        submittedAt: fixedSubmittedAt.toISOString(),
        gameMonth: 12,
        metrics: {
          money: 1200,
          cumulativeRevenue: 2200,
          totalServers: 10,
          computeCapacity: 40,
          memoryCapacity: 400,
          storageCapacity: 800,
          gpuCapacity: 0,
        },
      },
      {
        rank: 2,
        playerId: beta.playerId,
        username: "Beta Cloud",
        metric: "money",
        value: 900,
        submittedAt: fixedSubmittedAt.toISOString(),
        gameMonth: 11,
        metrics: {
          money: 900,
          cumulativeRevenue: 1900,
          totalServers: 9,
          computeCapacity: 30,
          memoryCapacity: 300,
          storageCapacity: 700,
          gpuCapacity: 0,
        },
      },
    ],
  });

  const invalid = await apiRequest<{ error: { code: string; message: string } }>(app, "/leaderboard?metric=bogus");
  assert.equal(invalid.response.status, 400);
  assert.equal(invalid.json?.error.code, "INVALID_LEADERBOARD_QUERY");
});

test("POST /leaderboard/runs preserves success, idempotent retry, and player-not-found contracts", async () => {
  const { app } = createContractTestApp();
  const player = await registerPlayer(app);
  const payload = {
    playerId: player?.playerId,
    clientRunId: "run-001",
    metrics: {
      money: 1250000,
      cumulativeRevenue: 2750000,
      totalServers: 12,
      computeCapacity: 160,
      memoryCapacity: 2048,
      storageCapacity: 800,
      gpuCapacity: 24,
    },
    gameMonth: 18,
  };

  const created = await apiRequest<{
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
    body: JSON.stringify(payload),
  });

  assert.equal(created.response.status, frozenEndpointContracts.submitLeaderboardRun.successStatus);
  assertJsonContentType(created.response);
  assert.equal(created.json?.created, true);
  assert.match(created.json?.run.runId ?? "", /^run_[a-f0-9]{32}$/);
  assert.equal(created.json?.run.playerId, player?.playerId);
  assert.equal(created.json?.run.clientRunId, payload.clientRunId);
  assert.equal(created.json?.run.gameMonth, payload.gameMonth);
  assert.equal(created.response.headers.get("retry-after"), null);

  const replay = await apiRequest<{ created: boolean; run: { runId: string } }>(app, "/leaderboard/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(replay.response.status, 200);
  assert.equal(replay.json?.created, false);
  assert.equal(replay.json?.run.runId, created.json?.run.runId);

  const missingPlayer = await apiRequest<{ error: { code: string; message: string } }>(app, "/leaderboard/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...payload,
      playerId: "player_missing",
      clientRunId: "run-missing",
    }),
  });
  assert.equal(missingPlayer.response.status, 404);
  assert.equal(missingPlayer.json?.error.code, "PLAYER_NOT_FOUND");
});

test("rate-limited requests preserve 429/RATE_LIMITED bodies and current header behavior", async () => {
  class DenyAllRateLimiter implements RateLimiter {
    consume(_scope: string, _key: string, _rule: RateLimitRule) {
      return {
        allowed: false,
        retryAfterSeconds: 42,
        remaining: 0,
      };
    }
  }

  const { app } = createContractTestApp({
    rateLimiter: new DenyAllRateLimiter(),
  });

  const playerRegistration = await apiRequest<{ error: { code: string; message: string } }>(app, "/players", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.10",
    },
    body: JSON.stringify({ username: "Acme Cloud" }),
  });

  assert.equal(playerRegistration.response.status, 429);
  assert.equal(playerRegistration.json?.error.code, "RATE_LIMITED");
  assert.match(playerRegistration.json?.error.message ?? "", /Retry after 42 seconds/);
  assert.equal(playerRegistration.response.headers.get("retry-after"), null);
  assertCurrentCorsBehavior(playerRegistration.response);

  const players = new InMemoryPlayersRepository();
  const player = await players.createPlayer({ username: "Rate Limited Cloud" });
  const registeredApp = createContractTestApp({
    rateLimiter: new DenyAllRateLimiter(),
    players,
    leaderboard: new InMemoryLeaderboardRepository(),
  });
  const leaderboardResponse = await apiRequest<{ error: { code: string; message: string } }>(
    registeredApp.app,
    "/leaderboard/runs",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "198.51.100.24",
      },
      body: JSON.stringify({
        playerId: player?.playerId,
        clientRunId: "run-limited",
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
    },
  );

  assert.equal(leaderboardResponse.response.status, 429);
  assert.equal(leaderboardResponse.json?.error.code, "RATE_LIMITED");
  assert.match(leaderboardResponse.json?.error.message ?? "", /Retry after 42 seconds/);
  assert.equal(leaderboardResponse.response.headers.get("retry-after"), null);
});
