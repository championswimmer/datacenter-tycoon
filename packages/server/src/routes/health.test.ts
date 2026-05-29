import assert from "node:assert/strict";
import { test } from "bun:test";
import { registerHealthRoutes } from "./health.js";
import { createElysiaServerApp } from "../server/elysia-app.js";
import { apiRequest, createTestDependencies } from "../test-utils/app.js";

function createHealthApp() {
  const dependencies = createTestDependencies();

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
    databaseConfigured: boolean;
  }>(app, "/healthz");

  assert.equal(response.status, 200);
  assert.deepEqual(json, {
    status: "ok",
    environment: "test",
    databaseConfigured: false,
  });
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
