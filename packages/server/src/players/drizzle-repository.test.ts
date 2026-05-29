import assert from "node:assert/strict";
import { test } from "bun:test";
import { createMigratedPgliteDatabase } from "../db/test-database.js";
import { DrizzlePlayersRepository } from "./drizzle-repository.js";
import { UsernameUnavailableError } from "./repository.js";

test("DrizzlePlayersRepository can create, load, and touch players", async () => {
  const database = await createMigratedPgliteDatabase();
  const repository = new DrizzlePlayersRepository(database);

  const created = await repository.createPlayer({ username: "  Acme Cloud  " });
  assert.equal(created.username, "Acme Cloud");

  const byNormalized = await repository.findByNormalizedUsername("acme cloud");
  assert.equal(byNormalized?.playerId, created.playerId);

  const touchedAt = new Date("2026-05-29T12:34:56.000Z");
  await repository.touchPlayer(created.playerId, touchedAt);
  const touched = await repository.findByPlayerId(created.playerId);
  assert.equal(touched?.lastSeenAt.toISOString(), touchedAt.toISOString());

  await assert.rejects(() => repository.createPlayer({ username: "acme cloud" }), (error: unknown) => {
    assert.ok(error instanceof UsernameUnavailableError);
    return true;
  });

  await database.close();
});
