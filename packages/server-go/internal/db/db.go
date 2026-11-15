// Package db provides the Postgres connection factory, migration runner and
// migration workflow for the Go server. It mirrors packages/server/src/db.
//
// Gap vs TS: there is no PGlite in Go. When DATABASE_URL is unset the server
// is expected to run on in-memory repositories (see DatabaseURL).
package db

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

// DatabaseURL returns the trimmed DATABASE_URL from env (a lookup function such
// as os.Getenv) and whether a Postgres database is configured. This is the same
// selection rule as parseDatabaseConfig in packages/server/src/config.ts: a
// non-blank DATABASE_URL selects Postgres; otherwise the server falls back to
// in-memory storage (the TS server falls back to PGlite).
func DatabaseURL(getenv func(string) string) (string, bool) {
	url := strings.TrimSpace(getenv("DATABASE_URL"))
	return url, url != ""
}

// Connect opens a pgx pool for the connection string and verifies connectivity.
func Connect(ctx context.Context, connectionString string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, connectionString)
	if err != nil {
		return nil, fmt.Errorf("create postgres pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
	}
	return pool, nil
}
