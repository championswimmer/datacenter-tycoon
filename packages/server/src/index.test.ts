import assert from "node:assert/strict";
import { test } from "bun:test";
import { ConfigError, loadServerConfig } from "./config.js";
import type { PlayersRepository } from "./players/repository.js";
import { createTestApp } from "./test-utils/app.js";

test("createTestApp accepts fake service overrides without contacting infrastructure", () => {
  const fakePlayersRepository: PlayersRepository = {
    findByNormalizedUsername: () => Promise.resolve(null),
    findByPlayerId: () => Promise.resolve(null),
    createPlayer: () => Promise.reject(new Error("not implemented")),
    touchPlayer: () => Promise.resolve(),
  };
  const { dependencies } = createTestApp({
    services: {
      players: fakePlayersRepository,
    },
  });

  assert.equal(dependencies.services.players, fakePlayersRepository);
});

test("loadServerConfig rejects missing production CORS origins", () => {
  assert.throws(
    () =>
      loadServerConfig({
        NODE_ENV: "production",
        PORT: "3000",
      }),
    (error: unknown) => {
      assert.ok(error instanceof ConfigError);
      assert.match(error.message, /CORS_ALLOWED_ORIGINS/);
      return true;
    },
  );
});

test("loadServerConfig rejects missing production DATABASE_URL", () => {
  assert.throws(
    () =>
      loadServerConfig({
        NODE_ENV: "production",
        PORT: "3000",
        CORS_ALLOWED_ORIGINS: "https://datacenter-tycoon.example",
      }),
    (error: unknown) => {
      assert.ok(error instanceof ConfigError);
      assert.match(error.message, /DATABASE_URL/);
      return true;
    },
  );
});

test("loadServerConfig defaults development to file-backed PGlite when DATABASE_URL is absent", () => {
  const config = loadServerConfig({
    NODE_ENV: "development",
    PORT: "3000",
    CORS_ALLOWED_ORIGINS: "http://localhost:5173",
  });

  assert.equal(config.database.mode, "pglite");
  assert.equal(config.database.pgliteDataDir, ".data/pglite");
  assert.equal(config.databaseUrl, undefined);
});

test("loadServerConfig prefers Postgres when DATABASE_URL is present", () => {
  const config = loadServerConfig({
    NODE_ENV: "development",
    PORT: "3000",
    CORS_ALLOWED_ORIGINS: "http://localhost:5173",
    DATABASE_URL: "postgres://127.0.0.1:5432/datacenter_tycoon",
  });

  assert.equal(config.database.mode, "postgres");
  assert.equal(config.database.connectionString, "postgres://127.0.0.1:5432/datacenter_tycoon");
  assert.equal(config.databaseUrl, "postgres://127.0.0.1:5432/datacenter_tycoon");
});

test("loadServerConfig always includes the first-party production web origin", () => {
  const config = loadServerConfig({
    NODE_ENV: "production",
    PORT: "3000",
    CORS_ALLOWED_ORIGINS: "https://dctycoon-api-production.up.railway.app",
    DATABASE_URL: "postgres://127.0.0.1:5432/datacenter_tycoon",
  });

  assert.deepEqual(config.corsAllowedOrigins, [
    "https://dctycoon-api-production.up.railway.app",
    "https://dctycoon.arnav.tech",
  ]);
});

test("loadServerConfig defaults global, leaderboard submission, and verification limits", () => {
  const config = loadServerConfig({
    NODE_ENV: "test",
  });

  assert.equal(config.rateLimits.backendGlobal.windowMs, 1_000);
  assert.equal(config.rateLimits.backendGlobal.maxRequests, 10);
  assert.equal(config.rateLimits.leaderboardSubmission.windowMs, 1_000);
  assert.equal(config.rateLimits.leaderboardSubmission.maxRequests, 1);
  assert.deepEqual(config.leaderboardVerification, {
    protocolVersion: "verified-run-v1",
    rulesetId: "leaderboard-ruleset-v1",
    maxTickDelta: 5,
    maxActionCount: 512,
    maxRequestBodyBytes: 262_144,
  });
});

test("loadServerConfig accepts explicit leaderboard verification settings", () => {
  const config = loadServerConfig({
    NODE_ENV: "test",
    LEADERBOARD_VERIFICATION_PROTOCOL_VERSION: "verified-run-v2",
    LEADERBOARD_VERIFICATION_RULESET_ID: "season-2026-07",
    LEADERBOARD_VERIFICATION_MAX_TICK_DELTA: "7",
    LEADERBOARD_VERIFICATION_MAX_ACTION_COUNT: "1024",
    LEADERBOARD_VERIFICATION_MAX_REQUEST_BODY_BYTES: "524288",
  });

  assert.deepEqual(config.leaderboardVerification, {
    protocolVersion: "verified-run-v2",
    rulesetId: "season-2026-07",
    maxTickDelta: 7,
    maxActionCount: 1024,
    maxRequestBodyBytes: 524_288,
  });
});

test("loadServerConfig rejects invalid leaderboard verification configuration", () => {
  assert.throws(
    () =>
      loadServerConfig({
        NODE_ENV: "test",
        LEADERBOARD_VERIFICATION_RULESET_ID: "bad ruleset id",
      }),
    (error: unknown) => {
      assert.ok(error instanceof ConfigError);
      assert.match(error.message, /LEADERBOARD_VERIFICATION_RULESET_ID/);
      return true;
    },
  );

  assert.throws(
    () =>
      loadServerConfig({
        NODE_ENV: "test",
        LEADERBOARD_VERIFICATION_MAX_TICK_DELTA: "0",
      }),
    (error: unknown) => {
      assert.ok(error instanceof ConfigError);
      assert.match(error.message, /LEADERBOARD_VERIFICATION_MAX_TICK_DELTA/);
      return true;
    },
  );
});

test("loadServerConfig rejects invalid rate-limit configuration", () => {
  assert.throws(
    () =>
      loadServerConfig({
        NODE_ENV: "test",
        BACKEND_RATE_LIMIT_MAX_REQUESTS: "0",
      }),
    (error: unknown) => {
      assert.ok(error instanceof ConfigError);
      assert.match(error.message, /BACKEND_RATE_LIMIT_MAX_REQUESTS/);
      return true;
    },
  );
});
