import assert from "node:assert/strict";
import { createVerifiedGenesisState } from "@datacenter-tycoon/game-logic";
import { test } from "bun:test";
import type { ServerConfig } from "../config.js";
import {
  InMemoryFixedWindowRateLimiter,
  type RateLimiter,
  type RateLimitRule,
} from "../rate-limit/fixed-window.js";
import type { RegisterPlayerInput } from "../players/repository.js";
import { InMemoryPlayersRepository, type PlayersRepository } from "../players/repository.js";
import {
  InMemoryLeaderboardRepository,
  type LeaderboardRepository,
} from "../leaderboard/repository.js";
import { createLeaderboardRunRecord } from "../leaderboard/types.js";
import { apiRequest, createTestApp } from "../test-utils/app.js";

async function registerPlayer(app: ReturnType<typeof createTestApp>["app"], username = "Acme Cloud") {
  const response = await apiRequest<{ playerId: string; username: string }>(app, "/players", {
    method: "POST",
    body: JSON.stringify({ username }),
    headers: { "content-type": "application/json" },
  });

  return response.json;
}

function createLeaderboardApp(options?: {
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

function buildGenesisPayload(playerId: string, clientRunId: string, seed = 42) {
  return {
    playerId,
    clientRunId,
    genesis: {
      seed,
      difficulty: "easy",
      rulesetId: "leaderboard-ruleset-v1",
    },
    parentHeadHash: null,
    actions: [],
  };
}

async function seedVerifiedRun(
  leaderboard: InMemoryLeaderboardRepository,
  input: {
    playerId: string;
    clientRunId: string;
    money: number;
    cumulativeRevenue: number;
    totalServers: number;
    computeCapacity: number;
    memoryCapacity: number;
    storageCapacity: number;
    gpuCapacity: number;
    gameMonth: number;
    submittedAt?: Date;
  },
) {
  const authoritativeState = createVerifiedGenesisState({
    seed: 42,
    difficulty: "easy",
    gameId: input.clientRunId as never,
    playerName: "Seeded",
  });

  authoritativeState.player.cash = input.money;
  authoritativeState.tick = input.gameMonth as never;

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
      authoritativeState,
      gameMonth: input.gameMonth,
    },
  });
}

test("POST /leaderboard/runs stores a verified genesis checkpoint", async () => {
  const { app } = createLeaderboardApp();
  const player = await registerPlayer(app);
  const { response, json } = await apiRequest<{
    created: boolean;
    rootHash: string;
    headHash: string;
    gameMonth: number;
    metrics: { money: number; cumulativeRevenue: number };
  }>(app, "/leaderboard/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(buildGenesisPayload(player!.playerId, "run-001")),
  });

  assert.equal(response.status, 201);
  assert.equal(json?.created, true);
  assert.match(json?.rootHash ?? "", /^[a-f0-9]{64}$/);
  assert.match(json?.headHash ?? "", /^[a-f0-9]{64}$/);
  assert.equal(json?.gameMonth, 0);
  assert.equal(json?.metrics.money, 8_000_000);
});

test("POST /leaderboard/runs is idempotent for exact retries", async () => {
  const { app } = createLeaderboardApp();
  const player = await registerPlayer(app);
  const payload = buildGenesisPayload(player!.playerId, "run-duplicate");

  const first = await apiRequest<{ created: boolean; headHash: string }>(app, "/leaderboard/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const second = await apiRequest<{ created: boolean; headHash: string }>(app, "/leaderboard/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  assert.equal(first.response.status, 201);
  assert.equal(second.response.status, 200);
  assert.equal(second.json?.created, false);
  assert.equal(second.json?.headHash, first.json?.headHash);
});

test("POST /leaderboard/runs rejects unknown player ids", async () => {
  const { app } = createLeaderboardApp();
  const { response, json } = await apiRequest<{ error: { code: string; message: string } }>(
    app,
    "/leaderboard/runs",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildGenesisPayload("player_missing", "run-404")),
    },
  );

  assert.equal(response.status, 404);
  assert.equal(json?.error.code, "PLAYER_NOT_FOUND");
});

test("POST /leaderboard/runs rejects raw summary payloads", async () => {
  const { app } = createLeaderboardApp();
  const player = await registerPlayer(app);
  const { response, json } = await apiRequest<{ error: { code: string; message: string } }>(
    app,
    "/leaderboard/runs",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        playerId: player!.playerId,
        clientRunId: "run-invalid",
        metrics: { money: 1 },
        gameMonth: 1,
      }),
    },
  );

  assert.equal(response.status, 400);
  assert.equal(json?.error.code, "INVALID_VERIFIED_RUN");
});

test("POST /leaderboard/runs advances an existing verified run from the current head", async () => {
  const { app } = createLeaderboardApp();
  const player = await registerPlayer(app);
  const first = await apiRequest<{ headHash: string }>(app, "/leaderboard/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(buildGenesisPayload(player!.playerId, "run-progress")),
  });

  const second = await apiRequest<{
    created: boolean;
    headHash: string;
    gameMonth: number;
    metrics: { money: number };
  }>(app, "/leaderboard/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      playerId: player!.playerId,
      clientRunId: "run-progress",
      parentHeadHash: first.json!.headHash,
      actions: [{ type: "Tick" }],
    }),
  });

  assert.equal(second.response.status, 200);
  assert.equal(second.json?.created, false);
  assert.equal(second.json?.gameMonth, 1);
  assert.notEqual(second.json?.headHash, first.json?.headHash);
});

test("POST /leaderboard/runs rejects stale parents and oversized tick gaps", async () => {
  const { app } = createLeaderboardApp();
  const player = await registerPlayer(app);
  const first = await apiRequest<{ headHash: string }>(app, "/leaderboard/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(buildGenesisPayload(player!.playerId, "run-branch")),
  });
  const second = await apiRequest<{ headHash: string }>(app, "/leaderboard/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      playerId: player!.playerId,
      clientRunId: "run-branch",
      parentHeadHash: first.json!.headHash,
      actions: [{ type: "Tick" }],
    }),
  });

  const stale = await apiRequest<{ error: { code: string } }>(app, "/leaderboard/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      playerId: player!.playerId,
      clientRunId: "run-branch",
      parentHeadHash: first.json!.headHash,
      actions: [],
    }),
  });
  const tooFar = await apiRequest<{ error: { code: string } }>(app, "/leaderboard/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      playerId: player!.playerId,
      clientRunId: "run-branch",
      parentHeadHash: second.json!.headHash,
      actions: Array.from({ length: 6 }, () => ({ type: "Tick" })),
    }),
  });

  assert.equal(stale.response.status, 409);
  assert.equal(stale.json?.error.code, "STALE_RUN_HEAD");
  assert.equal(tooFar.response.status, 409);
  assert.equal(tooFar.json?.error.code, "RUN_TICK_GAP_EXCEEDED");
});

test("POST /leaderboard/runs surfaces repository failures as internal errors", async () => {
  class BrokenLeaderboardRepository implements LeaderboardRepository {
    async findRunHead() {
      return null;
    }

    async commitVerifiedRun(): Promise<never> {
      throw new Error("database unavailable");
    }

    async listRuns() {
      return [];
    }
  }

  const players = new InMemoryPlayersRepository();
  const createdPlayer = await players.createPlayer({ username: "Acme Cloud" });
  const { app } = createLeaderboardApp({
    players,
    leaderboard: new BrokenLeaderboardRepository(),
  });
  const { response, json } = await apiRequest<{ error: { code: string; message: string } }>(
    app,
    "/leaderboard/runs",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildGenesisPayload(createdPlayer.playerId, "run-broken")),
    },
  );

  assert.equal(response.status, 500);
  assert.equal(json?.error.code, "INTERNAL_SERVER_ERROR");
  assert.match(json?.error.message ?? "", /database unavailable/);
});

test("GET /leaderboard returns ranked verified entries for a selected metric", async () => {
  const players = new InMemoryPlayersRepository();
  const leaderboard = new InMemoryLeaderboardRepository();
  const alpha = await players.createPlayer({ username: "Alpha Cloud" });
  const beta = await players.createPlayer({ username: "Beta Cloud" });
  const gamma = await players.createPlayer({ username: "Gamma Cloud" });

  await seedVerifiedRun(leaderboard, {
    playerId: beta.playerId,
    clientRunId: "run-beta",
    money: 950,
    cumulativeRevenue: 1_400,
    totalServers: 9,
    computeCapacity: 50,
    memoryCapacity: 300,
    storageCapacity: 200,
    gpuCapacity: 0,
    gameMonth: 9,
  });
  await seedVerifiedRun(leaderboard, {
    playerId: gamma.playerId,
    clientRunId: "run-gamma",
    money: 700,
    cumulativeRevenue: 1_900,
    totalServers: 7,
    computeCapacity: 30,
    memoryCapacity: 250,
    storageCapacity: 220,
    gpuCapacity: 10,
    gameMonth: 8,
  });
  await seedVerifiedRun(leaderboard, {
    playerId: alpha.playerId,
    clientRunId: "run-alpha",
    money: 1_200,
    cumulativeRevenue: 1_100,
    totalServers: 6,
    computeCapacity: 40,
    memoryCapacity: 200,
    storageCapacity: 100,
    gpuCapacity: 0,
    gameMonth: 7,
  });

  const { app } = createLeaderboardApp({ players, leaderboard });
  const { response, json } = await apiRequest<{
    metric: string;
    period: string;
    limit: number;
    visibility: string;
    entries: Array<{ rank: number; username: string; value: number }>;
  }>(app, "/leaderboard?metric=money&period=all-time&limit=2");

  assert.equal(response.status, 200);
  assert.equal(json?.metric, "money");
  assert.equal(json?.limit, 2);
  assert.equal(json?.visibility, "verified");
  assert.deepEqual(json?.entries.map((entry) => ({
    rank: entry.rank,
    username: entry.username,
    value: entry.value,
  })), [
    { rank: 1, username: "Alpha Cloud", value: 1_200 },
    { rank: 2, username: "Beta Cloud", value: 950 },
  ]);
});

test("GET /leaderboard applies deterministic tie-breaking for equal metric values", async () => {
  const fixedSubmittedAt = new Date("2026-05-18T12:00:00.000Z");
  const players = new InMemoryPlayersRepository();
  const leaderboard = new InMemoryLeaderboardRepository(() => fixedSubmittedAt);
  const alpha = await players.createPlayer({ username: "Alpha Cloud" });
  const bravo = await players.createPlayer({ username: "Bravo Cloud" });

  await seedVerifiedRun(leaderboard, {
    playerId: bravo.playerId,
    clientRunId: "bravo-run",
    money: 500,
    cumulativeRevenue: 500,
    totalServers: 5,
    computeCapacity: 10,
    memoryCapacity: 20,
    storageCapacity: 30,
    gpuCapacity: 0,
    gameMonth: 5,
    submittedAt: fixedSubmittedAt,
  });
  await seedVerifiedRun(leaderboard, {
    playerId: alpha.playerId,
    clientRunId: "alpha-run",
    money: 500,
    cumulativeRevenue: 500,
    totalServers: 5,
    computeCapacity: 10,
    memoryCapacity: 20,
    storageCapacity: 30,
    gpuCapacity: 0,
    gameMonth: 5,
    submittedAt: fixedSubmittedAt,
  });

  const { app } = createLeaderboardApp({ players, leaderboard });
  const { response, json } = await apiRequest<{
    entries: Array<{ rank: number; username: string; value: number }>;
  }>(app, "/leaderboard?metric=money&period=all-time&limit=5");

  assert.equal(response.status, 200);
  assert.deepEqual(json?.entries.map((entry) => entry.username), [
    "Alpha Cloud",
    "Bravo Cloud",
  ]);
});

test("GET /leaderboard can return all or only verified runs", async () => {
  const players = new InMemoryPlayersRepository();
  const leaderboard = new InMemoryLeaderboardRepository();
  const alpha = await players.createPlayer({ username: "Alpha Cloud" });
  const beta = await players.createPlayer({ username: "Beta Cloud" });
  const gamma = await players.createPlayer({ username: "Gamma Cloud" });

  await seedVerifiedRun(leaderboard, {
    playerId: alpha.playerId,
    clientRunId: "run-alpha",
    money: 900,
    cumulativeRevenue: 900,
    totalServers: 9,
    computeCapacity: 90,
    memoryCapacity: 90,
    storageCapacity: 90,
    gpuCapacity: 0,
    gameMonth: 9,
  });
  await seedVerifiedRun(leaderboard, {
    playerId: gamma.playerId,
    clientRunId: "run-gamma",
    money: 5_000,
    cumulativeRevenue: 0,
    totalServers: 1,
    computeCapacity: 10,
    memoryCapacity: 10,
    storageCapacity: 10,
    gpuCapacity: 0,
    gameMonth: 6,
  });
  await leaderboard.commitVerifiedRun({
    expectedParentHeadHash: null,
    run: createLeaderboardRunRecord({
      runId: "run-unverified",
      playerId: beta.playerId,
      clientRunId: "run-beta",
      verificationStatus: "unverified",
      metrics: {
        money: 1_200,
        cumulativeRevenue: 1_200,
        totalServers: 12,
        computeCapacity: 120,
        memoryCapacity: 120,
        storageCapacity: 120,
        gpuCapacity: 0,
      },
      gameMonth: 12,
      submittedAt: new Date("2026-05-17T12:00:00.000Z"),
    }),
    head: {
      playerId: beta.playerId,
      clientRunId: "run-beta",
      protocolVersion: "verified-run-v1",
      rulesetId: "leaderboard-ruleset-v1",
      genesisDescriptor: {
        seed: 42,
        difficulty: "easy",
        gameId: "run-beta" as never,
        playerName: "Beta Cloud",
      },
      rootHash: "e".repeat(64),
      headHash: "f".repeat(64),
      stateHash: "a".repeat(64),
      previousHeadHash: null,
      lastRequestHash: "b".repeat(64),
      authoritativeState: createVerifiedGenesisState({
        seed: 42,
        difficulty: "easy",
        gameId: "run-beta" as never,
        playerName: "Beta Cloud",
      }),
      gameMonth: 12,
    },
  });

  const { app } = createLeaderboardApp({ players, leaderboard });
  const verifiedOnly = await apiRequest<{
    visibility: string;
    entries: Array<{ username: string; value: number }>;
  }>(app, "/leaderboard?metric=money&period=all-time&limit=5");
  const allRuns = await apiRequest<{
    visibility: string;
    entries: Array<{ username: string; value: number }>;
  }>(app, "/leaderboard?metric=money&period=all-time&limit=5&visibility=all");

  assert.equal(verifiedOnly.response.status, 200);
  assert.equal(verifiedOnly.json?.visibility, "verified");
  assert.deepEqual(verifiedOnly.json?.entries.map((entry) => ({
    username: entry.username,
    value: entry.value,
  })), [
    { username: "Alpha Cloud", value: 900 },
  ]);

  assert.equal(allRuns.response.status, 200);
  assert.equal(allRuns.json?.visibility, "all");
  assert.deepEqual(allRuns.json?.entries.map((entry) => ({
    username: entry.username,
    value: entry.value,
  })), [
    { username: "Beta Cloud", value: 1_200 },
    { username: "Alpha Cloud", value: 900 },
  ]);
  assert.ok(allRuns.json?.entries.every((entry) => entry.username !== "Gamma Cloud"));
});

test("GET /leaderboard rejects invalid query parameters", async () => {
  const { app } = createLeaderboardApp();
  const { response, json } = await apiRequest<{ error: { code: string; message: string } }>(
    app,
    "/leaderboard?metric=bogus&period=all-time&limit=10",
  );
  const invalidVisibility = await apiRequest<{ error: { code: string; message: string } }>(
    app,
    "/leaderboard?metric=money&period=all-time&limit=10&visibility=legacy",
  );

  assert.equal(response.status, 400);
  assert.equal(json?.error.code, "INVALID_LEADERBOARD_QUERY");
  assert.equal(invalidVisibility.response.status, 400);
  assert.equal(invalidVisibility.json?.error.code, "INVALID_LEADERBOARD_QUERY");
});

test("POST /leaderboard/runs rate-limits repeated submissions from the same client", async () => {
  class DenyAllRateLimiter implements RateLimiter {
    consume(_scope: string, _key: string, _rule: RateLimitRule) {
      return {
        allowed: false,
        retryAfterSeconds: 15,
        remaining: 0,
      };
    }
  }

  const { app } = createLeaderboardApp({
    rateLimiter: new DenyAllRateLimiter(),
  });
  const player = await registerPlayer(app);
  const { response, json } = await apiRequest<{ error: { code: string; message: string } }>(
    app,
    "/leaderboard/runs",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "198.51.100.24",
      },
      body: JSON.stringify(buildGenesisPayload(player!.playerId, "run-limited")),
    },
  );

  assert.equal(response.status, 429);
  assert.equal(json?.error.code, "RATE_LIMITED");
  assert.match(json?.error.message ?? "", /Retry after 15 seconds/);
});

test("POST /leaderboard/runs allows one submission per second for the same client IP", async () => {
  const { app } = createLeaderboardApp({
    config: {
      rateLimits: {
        backendGlobal: { windowMs: 1_000, maxRequests: 100 },
        playerRegistration: { windowMs: 60_000, maxRequests: 100 },
        leaderboardSubmission: { windowMs: 1_000, maxRequests: 1 },
      },
    },
    rateLimiter: new InMemoryFixedWindowRateLimiter(),
  });
  const player = await registerPlayer(app);
  const requestHeaders = {
    "content-type": "application/json",
    "x-forwarded-for": "198.51.100.24",
  };
  const first = await apiRequest<{ created: boolean }>(app, "/leaderboard/runs", {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify(buildGenesisPayload(player!.playerId, "run-fast-1")),
  });
  const second = await apiRequest<{ error: { code: string; message: string } }>(app, "/leaderboard/runs", {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify(buildGenesisPayload(player!.playerId, "run-fast-2")),
  });
  const third = await apiRequest<{ created: boolean }>(app, "/leaderboard/runs", {
    method: "POST",
    headers: {
      ...requestHeaders,
      "x-forwarded-for": "198.51.100.25",
    },
    body: JSON.stringify(buildGenesisPayload(player!.playerId, "run-fast-3")),
  });

  assert.equal(first.response.status, 201);
  assert.equal(second.response.status, 429);
  assert.equal(second.json?.error.code, "RATE_LIMITED");
  assert.match(second.json?.error.message ?? "", /leaderboard submissions/i);
  assert.equal(third.response.status, 201);
});

test("service-level register input types remain usable in fake repositories", async () => {
  const sampleInput: RegisterPlayerInput = {
    username: "Acme Cloud",
  };

  assert.equal(sampleInput.username, "Acme Cloud");
});
