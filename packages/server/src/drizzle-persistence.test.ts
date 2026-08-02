import assert from "node:assert/strict";
import { test } from "bun:test";
import {
  createVerifiedGenesisState,
  selectOpenMarketContractsFromState,
  DATACENTER_CATALOG,
  RACK_CATALOG,
} from "@datacenter-tycoon/game-logic";
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
      // This flow submits the genesis checkpoint and a follow-up checkpoint back to back.
      LEADERBOARD_SUBMISSION_RATE_LIMIT_MAX_REQUESTS: "10",
    }),
    services: {
      players: new DrizzlePlayersRepository(database),
      leaderboard: new DrizzleLeaderboardRepository(database),
      rateLimiter: new InMemoryFixedWindowRateLimiter(),
    },
  });

  const registered = await apiRequest<{ playerId: string; username: string }>(app, "/players", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "Acme Cloud" }),
  });
  assert.equal(registered.response.status, 201);

  const submitted = await apiRequest<{ created: boolean; headHash: string; metrics: { money: number } }>(
    app,
    "/leaderboard/runs",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        playerId: registered.json?.playerId,
        clientRunId: "run-001",
        genesis: {
          seed: 42,
          difficulty: "easy",
          rulesetId: "leaderboard-ruleset-v1",
        },
        parentHeadHash: null,
        actions: [],
      }),
    },
  );
  assert.equal(submitted.response.status, 201);
  assert.match(submitted.json?.headHash ?? "", /^[a-f0-9]{64}$/);

  // The genesis checkpoint has not earned any revenue yet, so it must stay out of leaderboard reads.
  const emptyLeaderboard = await apiRequest<{
    entries: Array<{ username: string; value: number }>;
  }>(app, "/leaderboard?metric=money&period=all-time&limit=5");
  assert.equal(emptyLeaderboard.response.status, 200);
  assert.deepEqual(emptyLeaderboard.json?.entries, []);

  const earned = await apiRequest<{ created: boolean; metrics: { money: number; cumulativeRevenue: number } }>(
    app,
    "/leaderboard/runs",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        playerId: registered.json?.playerId,
        clientRunId: "run-001",
        parentHeadHash: submitted.json?.headHash,
        actions: buildRevenueActions("run-001", "Acme Cloud"),
      }),
    },
  );
  assert.equal(earned.response.status, 200);
  assert.equal(earned.json?.created, false);
  assert.ok((earned.json?.metrics.cumulativeRevenue ?? 0) > 0);

  const leaderboard = await apiRequest<{
    entries: Array<{ username: string; value: number }>;
  }>(app, "/leaderboard?metric=money&period=all-time&limit=5");
  assert.equal(leaderboard.response.status, 200);
  assert.equal(leaderboard.json?.entries[0]?.username, "Acme Cloud");
  assert.equal(leaderboard.json?.entries[0]?.value, earned.json?.metrics.money);

  await database.close();
});

/**
 * Builds a replayable action script that stands up a datacenter, serves the first
 * region-agnostic contract on offer, and ticks far enough to book real revenue.
 * Contract ids are seed-derived, so they are read back from the same genesis state
 * the server replays against.
 */
function buildRevenueActions(clientRunId: string, playerName: string) {
  const genesis = createVerifiedGenesisState({
    seed: 42,
    difficulty: "easy",
    gameId: clientRunId as never,
    playerName,
  });
  const contract = selectOpenMarketContractsFromState(genesis).find((offer) => !offer.regionAffinity);
  assert.ok(contract, "genesis contract market should offer a region-agnostic contract");

  const dcId = "dc-verified-1";

  return [
    { type: "BuildDatacenter", specId: DATACENTER_CATALOG.warehouse.id, dcId, regionId: "us_east" },
    { type: "PlaceRack", dcId, specId: RACK_CATALOG.C2.id, row: 0, position: 0, placementId: "rack-c2-1" },
    { type: "PlaceRack", dcId, specId: RACK_CATALOG.C2.id, row: 0, position: 1, placementId: "rack-c2-2" },
    { type: "PlaceRack", dcId, specId: RACK_CATALOG.M1.id, row: 0, position: 2, placementId: "rack-m1-1" },
    { type: "PlaceRack", dcId, specId: RACK_CATALOG.S2.id, row: 1, position: 0, placementId: "rack-s2-1" },
    { type: "AcceptContract", contractId: contract.id, dcId },
    { type: "Tick" },
    { type: "Tick" },
  ];
}
