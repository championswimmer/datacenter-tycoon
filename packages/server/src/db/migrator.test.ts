import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "bun:test";
import { createServerDatabase } from "./database.js";
import { loadMigrations, runDatabaseMigrations } from "./migrator.js";

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

test("runDatabaseMigrations applies baseline SQL through the shared queryable adapter", async () => {
  const migrationsDir = await mkdtemp(join(tmpdir(), "dct-adapter-migrations-"));
  const database = await createServerDatabase({
    mode: "pglite",
    dataDir: "memory://",
  });

  try {
    await writeFile(
      join(migrationsDir, "001_create_projects.sql"),
      [
        "CREATE TABLE projects (",
        "  id TEXT PRIMARY KEY,",
        "  name TEXT NOT NULL",
        ");",
      ].join("\n"),
    );
    await writeFile(
      join(migrationsDir, "002_seed_projects.sql"),
      "INSERT INTO projects (id, name) VALUES ('alpha', 'Alpha Cloud');\n",
    );

    const firstRun = await runDatabaseMigrations({
      database,
      migrationsDir,
    });

    assert.deepEqual(firstRun.appliedMigrations, [
      "001_create_projects.sql",
      "002_seed_projects.sql",
    ]);
    assert.deepEqual(firstRun.pendingMigrations, [
      "001_create_projects.sql",
      "002_seed_projects.sql",
    ]);

    const seededProjects = await database.query<{ id: string; name: string }>(
      "SELECT id, name FROM projects ORDER BY id ASC",
    );
    const appliedMigrations = await database.query<{ name: string }>(
      "SELECT name FROM schema_migrations ORDER BY name ASC",
    );

    assert.deepEqual(seededProjects.rows, [{ id: "alpha", name: "Alpha Cloud" }]);
    assert.deepEqual(appliedMigrations.rows, [
      { name: "001_create_projects.sql" },
      { name: "002_seed_projects.sql" },
    ]);

    const secondRun = await runDatabaseMigrations({
      database,
      migrationsDir,
    });

    assert.deepEqual(secondRun.appliedMigrations, []);
    assert.deepEqual(secondRun.pendingMigrations, []);
  } finally {
    await database.close();
    await rm(migrationsDir, { recursive: true, force: true });
  }
});
