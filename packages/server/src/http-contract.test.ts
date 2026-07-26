import assert from "node:assert/strict";
import { createVerifiedGenesisState } from "@datacenter-tycoon/game-logic";
import { test } from "bun:test";
import type { ServerConfig } from "./config.js";
import {
  InMemoryLeaderboardRepository,
  type LeaderboardRepository,
} from "./leaderboard/repository.js";
import { createLeaderboardRunRecord } from "./leaderboard/types.js";
import {
  InMemoryPlayersRepository,
  type PlayersRepository,
} from "./players/repository.js";
import {
  InMemoryFixedWindowRateLimiter,
  type RateLimiter,
  type RateLimitRule,
} from "./rate-limit/fixed-window.js";
import {
  frozenEndpointContracts,
  internalImplementationDetailsFreeToChange,
  stableTransportContractDetails,
} from "./test-utils/contracts.js";
import { apiRequest, createTestApp } from "./test-utils/app.js";

function assertJsonContentType(response: Response): void {
  assert.match(
    response.headers.get("content-type") ?? "",
    /^application\/json(?:;\s?charset=utf-8)?$/i,
  );
}

function assertCurrentCorsBehavior(response: Response): void {
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.equal(response.headers.get("access-control-allow-credentials"), "true");
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

function buildGenesisPayload(playerId: string, clientRunId: string) {
  return {
    playerId,
    clientRunId,
    genesis: {
      seed: 42,
      difficulty: "easy",
      rulesetId: "leaderboard-ruleset-v1",
    },
    parentHeadHash: null,
    actions: [],
  };
}

async function seedVerifiedRun(
  leaderboard: InMemoryLeaderboardRepository,
  input: { playerId: string; clientRunId: string; money: number; cumulativeRevenue: number; totalServers: number; computeCapacity: number; memoryCapacity: number; storageCapacity: number; gpuCapacity: number; gameMonth: number; submittedAt: Date },
) {
  const state = createVerifiedGenesisState({
    seed: 42,
    difficulty: "easy",
    gameId: input.clientRunId as never,
    playerName: "Seeded",
  });
  state.player.cash = input.money;
  state.tick = input.gameMonth as never;

  await leaderboard.commitVerifiedRun({
    expectedParentHeadHash: null,
    run: createLeaderboardRunRecord({
      runId: "placeholder",
      playerId: input.playerId,
      clientRunId: input.clientRunId,
      verificationStatus: "verified",
      metrics: {
        money: input.money,
        cumulativeRevenue: input.cumulativeRevenue,
        totalServers: input.totalServers,
        computeCapacity: input.computeCapacity,
        memoryCapacity: input.memoryCapacity,
        storageCapacity: input.storageCapacity,
        gpuCapacity: input.gpuCapacity,
      },
      gameMonth: input.gameMonth,
      submittedAt: input.submittedAt,
      updatedAt: input.submittedAt,
    }),
    head: {
      playerId: input.playerId,
      clientRunId: input.clientRunId,
      protocolVersion: "verified-run-v1",
      rulesetId: "leaderboard-ruleset-v1",
      genesisDescriptor: {
        seed: 42,
        difficulty: "easy",
        gameId: input.clientRunId as never,
        playerName: "Seeded",
      },
      rootHash: `${input.clientRunId}-root`.padEnd(64, "0").slice(0, 64),
      headHash: `${input.clientRunId}-head`.padEnd(64, "1").slice(0, 64),
      stateHash: `${input.clientRunId}-state`.padEnd(64, "2").slice(0, 64),
      previousHeadHash: null,
      lastRequestHash: `${input.clientRunId}-request`.padEnd(64, "3").slice(0, 64),
      authoritativeState: state,
      gameMonth: input.gameMonth,
    },
  });
}

function createContractTestApp(options?: {
  config?: Partial<ServerConfig>;
  players?: PlayersRepository;
  leaderboard?: LeaderboardRepository;
  rateLimiter?: RateLimiter;
}) {
  return createTestApp({
    config: {
      rateLimits: {
        backendGlobal: { windowMs: 1_000, maxRequests: 100 },
        playerRegistration: { windowMs: 60_000, maxRequests: 100 },
        leaderboardSubmission: { windowMs: 1_000, maxRequests: 100 },
      },
      ...options?.config,
    },
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
  assert.ok(stableTransportContractDetails.some((detail) => detail.includes("Elysia CORS metadata")));
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
    runtime: string;
    framework: string;
    databaseMode: string;
    databaseProvider: string;
    databaseConfigured: boolean;
  }>(app, frozenEndpointContracts.healthz.path);

  assert.equal(response.status, frozenEndpointContracts.healthz.successStatus);
  assertJsonContentType(response);
  assertCurrentCorsBehavior(response);
  assert.deepEqual(json, {
    status: "ok",
    environment: "test",
    runtime: "bun",
    framework: "elysia",
    databaseMode: "pglite",
    databaseProvider: "pglite-memory",
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
  assert.match(
    created.json?.playerId ?? "",
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );

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

  await seedVerifiedRun(leaderboard, {
    playerId: alpha.playerId,
    clientRunId: "run-alpha",
    money: 1200,
    cumulativeRevenue: 2200,
    totalServers: 10,
    computeCapacity: 40,
    memoryCapacity: 400,
    storageCapacity: 800,
    gpuCapacity: 0,
    gameMonth: 12,
    submittedAt: fixedSubmittedAt,
  });
  await seedVerifiedRun(leaderboard, {
    playerId: beta.playerId,
    clientRunId: "run-beta",
    money: 900,
    cumulativeRevenue: 1900,
    totalServers: 9,
    computeCapacity: 30,
    memoryCapacity: 300,
    storageCapacity: 700,
    gpuCapacity: 0,
    gameMonth: 11,
    submittedAt: fixedSubmittedAt,
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
  const payload = buildGenesisPayload(player!.playerId, "run-001");

  const created = await apiRequest<{
    created: boolean;
    rootHash: string;
    headHash: string;
    gameMonth: number;
    metrics: { money: number; cumulativeRevenue: number; totalServers: number };
  }>(app, "/leaderboard/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  assert.equal(created.response.status, frozenEndpointContracts.submitLeaderboardRun.successStatus);
  assertJsonContentType(created.response);
  assert.equal(created.json?.created, true);
  assert.match(created.json?.rootHash ?? "", /^[a-f0-9]{64}$/);
  assert.match(created.json?.headHash ?? "", /^[a-f0-9]{64}$/);
  assert.equal(created.json?.gameMonth, 0);
  assert.equal(created.response.headers.get("retry-after"), null);

  const replay = await apiRequest<{ created: boolean; headHash: string }>(app, "/leaderboard/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(replay.response.status, 200);
  assert.equal(replay.json?.created, false);
  assert.equal(replay.json?.headHash, created.json?.headHash);

  const missingPlayer = await apiRequest<{ error: { code: string; message: string } }>(app, "/leaderboard/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(buildGenesisPayload("player_missing", "run-missing")),
  });
  assert.equal(missingPlayer.response.status, 404);
  assert.equal(missingPlayer.json?.error.code, "PLAYER_NOT_FOUND");
});

test("global backend throttling applies to all routes after 10 requests in one second", async () => {
  const { app } = createContractTestApp({
    config: {
      rateLimits: {
        backendGlobal: { windowMs: 1_000, maxRequests: 10 },
        playerRegistration: { windowMs: 60_000, maxRequests: 100 },
        leaderboardSubmission: { windowMs: 1_000, maxRequests: 100 },
      },
    },
    rateLimiter: new InMemoryFixedWindowRateLimiter(),
  });

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await apiRequest(app, "/healthz");
    assert.equal(response.response.status, 200);
  }

  const limited = await apiRequest<{ error: { code: string; message: string } }>(app, "/healthz");
  assert.equal(limited.response.status, 429);
  assert.equal(limited.json?.error.code, "RATE_LIMITED");
  assert.match(limited.json?.error.message ?? "", /backend requests/i);
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

  const healthz = await apiRequest<{ error: { code: string; message: string } }>(app, "/healthz");
  assert.equal(healthz.response.status, 429);
  assert.equal(healthz.json?.error.code, "RATE_LIMITED");
  assert.match(healthz.json?.error.message ?? "", /backend requests/i);
  assert.equal(healthz.response.headers.get("retry-after"), null);
  assertCurrentCorsBehavior(healthz.response);

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
