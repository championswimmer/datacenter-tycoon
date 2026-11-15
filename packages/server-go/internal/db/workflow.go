package db

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"regexp"
	"strings"

	"github.com/championswimmer/datacenter-tycoon/server-go/migrations"
)

// WorkflowResult mirrors MigrationWorkflowResult (Postgres only).
type WorkflowResult struct {
	Mode                      string // always "postgres"
	Provider                  string // always "pgx"
	AppliedBaselineMigrations []string
	PendingBaselineMigrations []string
}

// MigrateDatabase runs the baseline SQL migrations and then initialises the
// Drizzle ledger (schema "drizzle", table "__drizzle_migrations") exactly as
// drizzle-orm's migrator does, so a database migrated by Go is
// indistinguishable from one migrated by the TS server. The Drizzle journal is
// currently empty; a non-empty journal is rejected because Go cannot apply
// Drizzle-generated migrations.
func MigrateDatabase(ctx context.Context, connectionString string) (WorkflowResult, error) {
	res := WorkflowResult{Mode: "postgres", Provider: "pgx"}
	pool, err := Connect(ctx, connectionString)
	if err != nil {
		return res, err
	}
	defer pool.Close()

	baseline, err := RunMigrations(ctx, pool, migrations.FS)
	if err != nil {
		return res, err
	}
	res.AppliedBaselineMigrations = baseline.AppliedMigrations
	res.PendingBaselineMigrations = baseline.PendingMigrations

	journal, err := readJournal(migrations.FS)
	if err != nil {
		return res, err
	}
	if len(journal.Entries) > 0 {
		return res, errors.New("drizzle journal has entries; the Go migrator cannot apply Drizzle-generated migrations yet")
	}
	if _, err := pool.Exec(ctx, `CREATE SCHEMA IF NOT EXISTS "drizzle"`); err != nil {
		return res, err
	}
	if _, err := pool.Exec(ctx, `CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
			id SERIAL PRIMARY KEY,
			hash text NOT NULL,
			created_at bigint
		)`); err != nil {
		return res, err
	}
	return res, nil
}

type drizzleJournal struct {
	Version string        `json:"version"`
	Dialect string        `json:"dialect"`
	Entries []interface{} `json:"entries"`
}

const journalPath = "drizzle/meta/_journal.json"

func readJournal(fsys fs.FS) (*drizzleJournal, error) {
	b, err := fs.ReadFile(fsys, journalPath)
	if err != nil {
		return nil, fmt.Errorf("drizzle migration journal is missing: %s", journalPath)
	}
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(b, &raw); err != nil {
		return nil, err
	}
	var j drizzleJournal
	if err := json.Unmarshal(b, &j); err != nil {
		return nil, err
	}
	if j.Dialect != "postgresql" {
		return nil, errors.New("Drizzle migration journal must declare dialect=postgresql.")
	}
	if raw["entries"] == nil || j.Entries == nil {
		return nil, errors.New("Drizzle migration journal must contain an entries array.")
	}
	return &j, nil
}

var migrationNamePattern = regexp.MustCompile(`^\d{3}_.+\.sql$`)

// ValidateMigrations mirrors check-migrations.ts. It returns the number of
// validated baseline migrations.
func ValidateMigrations(fsys fs.FS) (int, error) {
	ms, err := LoadMigrations(fsys)
	if err != nil {
		return 0, err
	}
	if len(ms) == 0 {
		return 0, errors.New("No SQL migrations were found under packages/server/migrations.")
	}
	for _, m := range ms {
		if !migrationNamePattern.MatchString(m.Name) {
			return 0, fmt.Errorf("Migration %s must use the NNN_description.sql naming convention.", m.Name)
		}
		if len(strings.TrimSpace(m.SQL)) == 0 {
			return 0, fmt.Errorf("Migration %s is empty.", m.Name)
		}
	}
	if _, err := readJournal(fsys); err != nil {
		return 0, err
	}
	return len(ms), nil
}
