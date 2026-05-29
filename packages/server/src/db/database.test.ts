import assert from "node:assert/strict";
import { test } from "bun:test";
import { createServerDatabase } from "./database.js";

test("createServerDatabase exposes a queryable PGlite adapter with transaction helpers", async () => {
  const database = await createServerDatabase({
    mode: "pglite",
    dataDir: "memory://",
  });

  assert.equal(database.mode, "pglite");

  await database.exec(`
    CREATE TABLE adapter_test_items (
      id TEXT PRIMARY KEY,
      value INTEGER NOT NULL
    )
  `);

  await database.transaction(async (transaction) => {
    await transaction.query(
      "INSERT INTO adapter_test_items (id, value) VALUES ($1, $2)",
      ["alpha", 1],
    );
    await transaction.query(
      "INSERT INTO adapter_test_items (id, value) VALUES ($1, $2)",
      ["beta", 2],
    );
  });

  const result = await database.query<{ id: string; value: number }>(
    "SELECT id, value FROM adapter_test_items ORDER BY id ASC",
  );
  assert.deepEqual(result.rows, [
    { id: "alpha", value: 1 },
    { id: "beta", value: 2 },
  ]);

  await database.close();
  assert.equal(database.client.closed, true);
});

test("createServerDatabase can construct a Bun SQL-backed Drizzle connection wrapper", async () => {
  const database = await createServerDatabase({
    mode: "postgres",
    connectionString: "postgres://127.0.0.1:1/postgres",
  });

  assert.equal(database.mode, "postgres");
  assert.equal(typeof database.db, "object");
  assert.equal(typeof database.query, "function");
  assert.equal(typeof database.transaction, "function");

  await database.close();
});
