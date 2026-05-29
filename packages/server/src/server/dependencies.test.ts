import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "bun:test";
import { loadServerConfig } from "../config.js";
import { InMemoryLeaderboardRepository, DrizzleLeaderboardRepository } from "../leaderboard/repository.js";
import { DrizzlePlayersRepository } from "../players/drizzle-repository.js";
import { InMemoryPlayersRepository } from "../players/repository.js";
import { InMemoryFixedWindowRateLimiter } from "../rate-limit/fixed-window.js";
import { createApp } from "../index.js";
import type { ServerServicesFactory } from "../types.js";
import {
  createDefaultServerServices,
  createRuntimeServerServices,
  resolveAppDependencies,
} from "./dependencies.js";
import { apiRequest } from "../test-utils/app.js";

function createConfig() {
  return loadServerConfig({
    NODE_ENV: "test",
    PORT: "4010",
    HOST: "127.0.0.1",
    CORS_ALLOWED_ORIGINS: "http://localhost:5173,http://localhost:4173",
    SERVER_VERSION: "9.9.9-test",
  });
}

test("resolveAppDependencies keeps transport wiring independent from persistence construction", () => {
  const factoryPlayers = new InMemoryPlayersRepository();
  const factoryLeaderboard = new InMemoryLeaderboardRepository();
  const factoryRateLimiter = new InMemoryFixedWindowRateLimiter();
  const overrideRateLimiter = new InMemoryFixedWindowRateLimiter();

  const resolved = resolveAppDependencies(
    {
      config: createConfig(),
      services: {
        rateLimiter: overrideRateLimiter,
      },
    },
    () => ({
      players: factoryPlayers,
      leaderboard: factoryLeaderboard,
      rateLimiter: factoryRateLimiter,
    }),
  );

  assert.equal(resolved.services.players, factoryPlayers);
  assert.equal(resolved.services.leaderboard, factoryLeaderboard);
  assert.equal(resolved.services.rateLimiter, overrideRateLimiter);
});

test("createDefaultServerServices wires DATABASE_URL configs to Drizzle repositories", () => {
  const services = createDefaultServerServices(
    loadServerConfig({
      NODE_ENV: "test",
      PORT: "4010",
      HOST: "127.0.0.1",
      CORS_ALLOWED_ORIGINS: "http://localhost:5173,http://localhost:4173",
      SERVER_VERSION: "9.9.9-test",
      DATABASE_URL: "postgres://127.0.0.1:1/postgres",
    }),
  );

  assert.ok(services.players instanceof DrizzlePlayersRepository);
  assert.ok(services.leaderboard instanceof DrizzleLeaderboardRepository);
});

test("createRuntimeServerServices defaults development to PGlite-backed Drizzle repositories", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "dct-runtime-pglite-"));

  try {
    const services = await createRuntimeServerServices(
      loadServerConfig({
        NODE_ENV: "development",
        PORT: "4010",
        HOST: "127.0.0.1",
        CORS_ALLOWED_ORIGINS: "http://localhost:5173,http://localhost:4173",
        SERVER_VERSION: "9.9.9-test",
        PGLITE_DATA_DIR: dataDir,
      }),
    );

    assert.ok(services.players instanceof DrizzlePlayersRepository);
    assert.ok(services.leaderboard instanceof DrizzleLeaderboardRepository);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("createApp can swap persistence factories without changing transport tests", async () => {
  const players = new InMemoryPlayersRepository();
  const leaderboard = new InMemoryLeaderboardRepository();
  const rateLimiter = new InMemoryFixedWindowRateLimiter();

  const createFakeServices: ServerServicesFactory = () => ({
    players,
    leaderboard,
    rateLimiter,
  });

  const app = createApp(
    {
      config: createConfig(),
      services: {},
    },
    createFakeServices,
  );

  const { response, json } = await apiRequest<{
    username: string;
    available: boolean;
  }>(app, "/players/availability?username=Boundary%20Cloud");

  assert.equal(response.status, 200);
  assert.deepEqual(json, {
    username: "Boundary Cloud",
    available: true,
  });
});
