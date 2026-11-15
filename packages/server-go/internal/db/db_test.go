package db_test

import (
	"context"
	"testing"
	"testing/fstest"

	"github.com/championswimmer/datacenter-tycoon/server-go/internal/db"
	"github.com/championswimmer/datacenter-tycoon/server-go/internal/db/dbtest"
	"github.com/championswimmer/datacenter-tycoon/server-go/migrations"
)

func TestDatabaseURL(t *testing.T) {
	env := map[string]string{"DATABASE_URL": "  postgres://x/y  "}
	u, ok := db.DatabaseURL(func(k string) string { return env[k] })
	if !ok || u != "postgres://x/y" {
		t.Fatalf("got %q %v", u, ok)
	}
	if _, ok := db.DatabaseURL(func(string) string { return "   " }); ok {
		t.Fatal("blank URL must be unconfigured")
	}
}

func TestLoadMigrationsSortsAndIgnoresNonSQL(t *testing.T) {
	fsys := fstest.MapFS{
		"002_second.sql": {Data: []byte("SELECT 2;\n")},
		"README.md":      {Data: []byte("ignored\n")},
		"001_first.sql":  {Data: []byte("SELECT 1;\n")},
	}
	ms, err := db.LoadMigrations(fsys)
	if err != nil || len(ms) != 2 || ms[0].Name != "001_first.sql" || ms[1].SQL != "SELECT 2;\n" {
		t.Fatalf("unexpected: %v %v", ms, err)
	}
}

func TestValidateMigrations(t *testing.T) {
	if n, err := db.ValidateMigrations(migrations.FS); err != nil || n != 2 {
		t.Fatalf("embedded: %d %v", n, err)
	}
	bad := fstest.MapFS{"x.sql": {Data: []byte("SELECT 1")}}
	if _, err := db.ValidateMigrations(bad); err == nil {
		t.Fatal("expected naming error")
	}
}

func TestRunMigrationsAppliesAndIsIdempotent(t *testing.T) {
	pool := dbtest.NewPool(t)
	ctx := context.Background()
	fsys := fstest.MapFS{
		"001_create_projects.sql": {Data: []byte("CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL);")},
		"002_seed_projects.sql":   {Data: []byte("INSERT INTO projects (id, name) VALUES ('alpha', 'Alpha Cloud');\nINSERT INTO projects (id, name) VALUES ('beta', 'B');\n")},
	}
	first, err := db.RunMigrations(ctx, pool, fsys)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"001_create_projects.sql", "002_seed_projects.sql"}
	if len(first.AppliedMigrations) != 2 || first.AppliedMigrations[0] != want[0] || len(first.PendingMigrations) != 2 {
		t.Fatalf("first run: %+v", first)
	}
	var n int
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM projects").Scan(&n); err != nil || n != 2 {
		t.Fatalf("projects: %d %v", n, err)
	}
	second, err := db.RunMigrations(ctx, pool, fsys)
	if err != nil || len(second.AppliedMigrations) != 0 || len(second.PendingMigrations) != 0 {
		t.Fatalf("second run: %+v %v", second, err)
	}
}

func TestRunMigrationsRollsBackFailedMigration(t *testing.T) {
	pool := dbtest.NewPool(t)
	ctx := context.Background()
	fsys := fstest.MapFS{"001_bad.sql": {Data: []byte("CREATE TABLE a (id int); SELECT * FROM nope;")}}
	if _, err := db.RunMigrations(ctx, pool, fsys); err == nil {
		t.Fatal("expected failure")
	}
	var n int
	_ = pool.QueryRow(ctx, "SELECT count(*) FROM schema_migrations").Scan(&n)
	var reg *string
	_ = pool.QueryRow(ctx, "SELECT to_regclass('a')::text").Scan(&reg)
	if n != 0 || reg != nil {
		t.Fatalf("not rolled back: rows=%d table=%v", n, reg)
	}
}

func TestMigrateDatabaseBootstrapsBaselineAndDrizzleLedger(t *testing.T) {
	url := dbtest.NewDatabaseURL(t)
	ctx := context.Background()
	res, err := db.MigrateDatabase(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	if len(res.AppliedBaselineMigrations) != 2 || res.AppliedBaselineMigrations[0] != "001_leaderboard_foundation.sql" {
		t.Fatalf("applied: %+v", res)
	}
	again, err := db.MigrateDatabase(ctx, url)
	if err != nil || len(again.AppliedBaselineMigrations) != 0 {
		t.Fatalf("rerun: %+v %v", again, err)
	}
	pool, err := db.Connect(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	var ledger string
	if err := pool.QueryRow(ctx, "select table_name from information_schema.tables where table_name = '__drizzle_migrations'").Scan(&ledger); err != nil {
		t.Fatal(err)
	}
	for _, tbl := range []string{"players", "leaderboard_runs", "verified_leaderboard_run_heads"} {
		var reg *string
		if err := pool.QueryRow(ctx, "SELECT to_regclass($1)::text", tbl).Scan(&reg); err != nil || reg == nil {
			t.Fatalf("missing table %s", tbl)
		}
	}
}
