import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "bun:test";
import { createServerDatabase } from "./database.js";
import { migrateConfiguredDatabase, resolveMigrationTarget } from "./migration-workflow.js";

test("resolveMigrationTarget prefers DATABASE_URL over PGLITE_DATA_DIR", () => {
  assert.deepEqual(
    resolveMigrationTarget({
      DATABASE_URL: "postgres://127.0.0.1:5432/datacenter_tycoon",
      PGLITE_DATA_DIR: "/tmp/dct-pglite",
    }),
    {
      mode: "postgres",
      connectionString: "postgres://127.0.0.1:5432/datacenter_tycoon",
    },
  );
});

test("migrateConfiguredDatabase bootstraps an empty PGlite database with the SQL baseline and Drizzle journal", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "dct-pglite-"));

  try {
    const result = await migrateConfiguredDatabase({
      PGLITE_DATA_DIR: dataDir,
    });

    assert.equal(result.mode, "pglite");
    assert.deepEqual(result.appliedBaselineMigrations, ["001_leaderboard_foundation.sql"]);

    const database = await createServerDatabase({
      mode: "pglite",
      dataDir,
    });

    if (database.mode !== "pglite") {
      throw new Error("Expected a PGlite database.");
    }

    const baselineRows = await database.client.query<{ name: string }>(
      "select name from schema_migrations order by name asc",
    );
    const drizzleLedger = await database.client.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_name = '__drizzle_migrations'",
    );

    assert.deepEqual(baselineRows.rows, [{ name: "001_leaderboard_foundation.sql" }]);
    assert.deepEqual(drizzleLedger.rows, [{ table_name: "__drizzle_migrations" }]);

    await database.close();
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});
