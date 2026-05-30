import assert from "node:assert/strict";
import { test } from "bun:test";
import type { ServerConfig } from "../config.js";
import { createElysiaServerApp } from "../server/elysia-app.js";
import { apiRequest, createTestDependencies } from "../test-utils/app.js";
import { registerHealthRoutes } from "./health.js";

function createHealthApp(config?: Partial<ServerConfig>) {
  const dependencies = createTestDependencies({ config });

  return createElysiaServerApp({
    context: dependencies,
    register: registerHealthRoutes,
  });
}

test("GET /healthz returns liveness information", async () => {
  const app = createHealthApp();
  const { response, json } = await apiRequest<{
    status: string;
    environment: string;
    runtime: string;
    framework: string;
    databaseMode: string;
    databaseProvider: string;
    databaseConfigured: boolean;
  }>(app, "/healthz");

  assert.equal(response.status, 200);
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

test("GET /healthz reports file-backed PGlite metadata for development configs", async () => {
  const app = createHealthApp({
    environment: "development",
    database: {
      mode: "pglite",
      pgliteDataDir: "/tmp/dct-healthz-pglite",
    },
  });
  const { response, json } = await apiRequest<{
    databaseMode: string;
    databaseProvider: string;
    databaseConfigured: boolean;
  }>(app, "/healthz");

  assert.equal(response.status, 200);
  assert.equal(json?.databaseMode, "pglite");
  assert.equal(json?.databaseProvider, "pglite-file");
  assert.equal(json?.databaseConfigured, true);
});

test("GET /healthz reports Bun SQL metadata for production Postgres configs", async () => {
  const app = createHealthApp({
    environment: "production",
    database: {
      mode: "postgres",
      connectionString: "postgres://127.0.0.1:5432/datacenter_tycoon",
    },
  });
  const { response, json } = await apiRequest<{
    databaseMode: string;
    databaseProvider: string;
    databaseConfigured: boolean;
  }>(app, "/healthz");

  assert.equal(response.status, 200);
  assert.equal(json?.databaseMode, "postgres");
  assert.equal(json?.databaseProvider, "bun-sql");
  assert.equal(json?.databaseConfigured, true);
});

test("GET /version returns server and game-logic versions", async () => {
  const app = createHealthApp();
  const { response, json } = await apiRequest<{
    serverVersion: string;
    gameLogicVersion: string;
  }>(app, "/version");

  assert.equal(response.status, 200);
  assert.equal(json?.serverVersion, "9.9.9-test");
  assert.match(json?.gameLogicVersion ?? "", /^\d+\.\d+\.\d+/);
});
