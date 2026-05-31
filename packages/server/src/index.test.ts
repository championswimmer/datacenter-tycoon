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

test("loadServerConfig defaults global and leaderboard submission rate limits to the anti-spam profile", () => {
  const config = loadServerConfig({
    NODE_ENV: "test",
  });

  assert.equal(config.rateLimits.backendGlobal.windowMs, 1_000);
  assert.equal(config.rateLimits.backendGlobal.maxRequests, 10);
  assert.equal(config.rateLimits.leaderboardSubmission.windowMs, 1_000);
  assert.equal(config.rateLimits.leaderboardSubmission.maxRequests, 1);
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
