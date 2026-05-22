import assert from "node:assert/strict";
import { test } from "node:test";
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

test("loadServerConfig rejects invalid rate-limit configuration", () => {
  assert.throws(
    () =>
      loadServerConfig({
        NODE_ENV: "test",
        PLAYER_REGISTRATION_RATE_LIMIT_MAX_REQUESTS: "0",
      }),
    (error: unknown) => {
      assert.ok(error instanceof ConfigError);
      assert.match(error.message, /PLAYER_REGISTRATION_RATE_LIMIT_MAX_REQUESTS/);
      return true;
    },
  );
});
