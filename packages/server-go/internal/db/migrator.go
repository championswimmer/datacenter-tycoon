package db

import (
	"context"
	"fmt"
	"io/fs"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// MigrationsTable is the baseline tracking table shared with the TS server
// (columns: name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ). The TS migrator
// stores no checksum; neither does this one.
const MigrationsTable = "schema_migrations"

// Migration is a loaded SQL migration file.
type Migration struct {
	Name string
	SQL  string
}

// MigrationRunResult mirrors the TS MigrationRunResult.
type MigrationRunResult struct {
	AppliedMigrations []string
	PendingMigrations []string
}

// LoadMigrations returns the *.sql files at the root of fsys sorted by name.
func LoadMigrations(fsys fs.FS) ([]Migration, error) {
	entries, err := fs.ReadDir(fsys, ".")
	if err != nil {
		return nil, err
	}
	var names []string
	for _, e := range entries {
		if e.Type().IsRegular() && strings.HasSuffix(e.Name(), ".sql") {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)
	out := make([]Migration, 0, len(names))
	for _, n := range names {
		b, err := fs.ReadFile(fsys, n)
		if err != nil {
			return nil, err
		}
		out = append(out, Migration{Name: n, SQL: string(b)})
	}
	return out, nil
}

// RunMigrations applies pending baseline migrations: each file runs together
// with its tracking-row insert in one transaction, exactly like
// runDatabaseMigrations in migrator.ts.
func RunMigrations(ctx context.Context, pool *pgxpool.Pool, fsys fs.FS) (MigrationRunResult, error) {
	result := MigrationRunResult{AppliedMigrations: []string{}, PendingMigrations: []string{}}
	migrations, err := LoadMigrations(fsys)
	if err != nil {
		return result, err
	}
	if _, err := pool.Exec(ctx, fmt.Sprintf(`
    CREATE TABLE IF NOT EXISTS %s (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `, MigrationsTable)); err != nil {
		return result, err
	}
	rows, err := pool.Query(ctx, fmt.Sprintf("SELECT name FROM %s ORDER BY name ASC", MigrationsTable))
	if err != nil {
		return result, err
	}
	applied := map[string]bool{}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			rows.Close()
			return result, err
		}
		applied[name] = true
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return result, err
	}
	for _, m := range migrations {
		if !applied[m.Name] {
			result.PendingMigrations = append(result.PendingMigrations, m.Name)
		}
	}
	for _, m := range migrations {
		if applied[m.Name] {
			continue
		}
		m := m
		err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
			// No arguments => simple protocol, so multi-statement files work.
			if _, err := tx.Exec(ctx, m.SQL); err != nil {
				return err
			}
			_, err := tx.Exec(ctx, fmt.Sprintf("INSERT INTO %s (name) VALUES ($1)", MigrationsTable), m.Name)
			return err
		})
		if err != nil {
			return result, fmt.Errorf("apply migration %s: %w", m.Name, err)
		}
		result.AppliedMigrations = append(result.AppliedMigrations, m.Name)
	}
	return result, nil
}
