import assert from "node:assert/strict";
import { test } from "node:test";
import { ConfigError, loadServerConfig } from "./config.js";
import { createApp } from "./index.js";

function createTestConfig() {
  return loadServerConfig({
    NODE_ENV: "test",
    PORT: "4010",
    HOST: "127.0.0.1",
    CORS_ALLOWED_ORIGINS: "http://localhost:5173,http://localhost:4173",
    SERVER_VERSION: "9.9.9-test",
  });
}

test("GET /healthz returns liveness information", async () => {
  const app = createApp(createTestConfig());
  const response = await app.fetch(new Request("http://localhost/healthz"));
  const payload = (await response.json()) as {
    status: string;
    environment: string;
    databaseConfigured: boolean;
  };

  assert.equal(response.status, 200);
  assert.equal(payload.status, "ok");
  assert.equal(payload.environment, "test");
  assert.equal(payload.databaseConfigured, false);
});

test("GET /version returns server and game-logic versions", async () => {
  const app = createApp(createTestConfig());
  const response = await app.fetch(new Request("http://localhost/version"));
  const payload = (await response.json()) as {
    serverVersion: string;
    gameLogicVersion: string;
  };

  assert.equal(response.status, 200);
  assert.equal(payload.serverVersion, "9.9.9-test");
  assert.match(payload.gameLogicVersion, /^\d+\.\d+\.\d+/);
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
