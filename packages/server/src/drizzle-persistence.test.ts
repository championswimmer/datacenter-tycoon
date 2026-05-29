import assert from "node:assert/strict";
import { test } from "bun:test";
import { loadServerConfig } from "./config.js";
import { DrizzlePlayersRepository } from "./players/drizzle-repository.js";
import { DrizzleLeaderboardRepository } from "./leaderboard/repository.js";
import { InMemoryFixedWindowRateLimiter } from "./rate-limit/fixed-window.js";
import { createApp } from "./index.js";
import { apiRequest } from "./test-utils/app.js";
import { createMigratedPgliteDatabase } from "./db/test-database.js";

test("request-level flows work with Drizzle repositories backed by PGlite", async () => {
  const database = await createMigratedPgliteDatabase();
  const app = createApp({
    config: loadServerConfig({
      NODE_ENV: "test",
      PORT: "4010",
      HOST: "127.0.0.1",
      CORS_ALLOWED_ORIGINS: "http://localhost:5173,http://localhost:4173",
      SERVER_VERSION: "9.9.9-test",
    }),
    services: {
      players: new DrizzlePlayersRepository(database.db),
      leaderboard: new DrizzleLeaderboardRepository(database.db),
      rateLimiter: new InMemoryFixedWindowRateLimiter(),
    },
  });

  const registered = await apiRequest<{ playerId: string; username: string }>(app, "/players", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "Acme Cloud" }),
  });
  assert.equal(registered.response.status, 201);

  const submitted = await apiRequest<{ created: boolean; run: { playerId: string } }>(
    app,
    "/leaderboard/runs",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        playerId: registered.json?.playerId,
        clientRunId: "run-001",
        metrics: {
          money: 100,
          cumulativeRevenue: 200,
          totalServers: 3,
          computeCapacity: 10,
          memoryCapacity: 20,
          storageCapacity: 30,
          gpuCapacity: 40,
        },
        gameMonth: 6,
      }),
    },
  );
  assert.equal(submitted.response.status, 201);
  assert.equal(submitted.json?.run.playerId, registered.json?.playerId);

  const leaderboard = await apiRequest<{
    entries: Array<{ username: string; value: number }>;
  }>(app, "/leaderboard?metric=money&period=all-time&limit=5");
  assert.equal(leaderboard.response.status, 200);
  assert.equal(leaderboard.json?.entries[0]?.username, "Acme Cloud");
  assert.equal(leaderboard.json?.entries[0]?.value, 100);

  await database.close();
});
