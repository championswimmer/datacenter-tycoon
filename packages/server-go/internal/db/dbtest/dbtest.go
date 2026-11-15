// Package dbtest provides isolated Postgres databases for tests. Tests are
// skipped when TEST_DATABASE_URL is unset.
package dbtest

import (
	"context"
	"fmt"
	"net/url"
	"os"
	"sync/atomic"
	"testing"
	"time"

	"github.com/championswimmer/datacenter-tycoon/server-go/internal/db"
	"github.com/championswimmer/datacenter-tycoon/server-go/migrations"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var counter atomic.Int64

// AdminURL returns TEST_DATABASE_URL or skips the test.
func AdminURL(t testing.TB) string {
	t.Helper()
	u := os.Getenv("TEST_DATABASE_URL")
	if u == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping Postgres test")
	}
	return u
}

// NewDatabaseURL creates a fresh empty database and returns its URL. It is
// dropped on test cleanup.
func NewDatabaseURL(t testing.TB) string {
	t.Helper()
	admin := AdminURL(t)
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, admin)
	if err != nil {
		t.Fatalf("connect admin: %v", err)
	}
	defer conn.Close(ctx)
	name := fmt.Sprintf("dtgo_test_%d_%d_%d", os.Getpid(), time.Now().UnixNano()%1e9, counter.Add(1))
	if _, err := conn.Exec(ctx, "CREATE DATABASE "+name); err != nil {
		t.Fatalf("create database: %v", err)
	}
	t.Cleanup(func() {
		c, err := pgx.Connect(ctx, admin)
		if err != nil {
			return
		}
		defer c.Close(ctx)
		_, _ = c.Exec(ctx, "DROP DATABASE IF EXISTS "+name+" WITH (FORCE)")
	})
	u, err := url.Parse(admin)
	if err != nil {
		t.Fatalf("parse url: %v", err)
	}
	u.Path = "/" + name
	return u.String()
}

// NewPool returns a pool on a fresh, unmigrated database.
func NewPool(t testing.TB) *pgxpool.Pool {
	t.Helper()
	pool, err := db.Connect(context.Background(), NewDatabaseURL(t))
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

// NewMigratedPool returns a pool on a fresh database with baseline migrations applied.
func NewMigratedPool(t testing.TB) *pgxpool.Pool {
	t.Helper()
	pool := NewPool(t)
	if _, err := db.RunMigrations(context.Background(), pool, migrations.FS); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return pool
}
