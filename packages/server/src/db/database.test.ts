import assert from "node:assert/strict";
import { test } from "bun:test";
import { createServerDatabase } from "./database.js";

test("createServerDatabase can open and close a fileless PGlite-backed Drizzle connection", async () => {
  const database = await createServerDatabase({
    mode: "pglite",
    dataDir: "memory://",
  });

  assert.equal(database.mode, "pglite");

  const result = await database.client.query<{ value: number }>("select 1 as value");
  assert.equal(result.rows[0]?.value, 1);

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

  await database.close();
});
