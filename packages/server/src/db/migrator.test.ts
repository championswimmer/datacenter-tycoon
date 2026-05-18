import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadMigrations } from "./migrator.js";

test("loadMigrations sorts SQL files lexicographically and ignores non-SQL files", async () => {
  const migrationsDir = await mkdtemp(join(tmpdir(), "dct-migrations-"));

  try {
    await writeFile(join(migrationsDir, "002_second.sql"), "SELECT 2;\n");
    await writeFile(join(migrationsDir, "README.md"), "ignored\n");
    await writeFile(join(migrationsDir, "001_first.sql"), "SELECT 1;\n");

    const migrations = await loadMigrations(migrationsDir);

    assert.deepEqual(
      migrations.map((migration) => migration.name),
      ["001_first.sql", "002_second.sql"],
    );
    assert.equal(migrations[0]?.sql, "SELECT 1;\n");
    assert.equal(migrations[1]?.sql, "SELECT 2;\n");
  } finally {
    await rm(migrationsDir, { recursive: true, force: true });
  }
});
