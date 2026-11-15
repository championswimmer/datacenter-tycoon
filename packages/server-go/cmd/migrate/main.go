// Command migrate applies baseline SQL migrations to DATABASE_URL (Railway
// pre-deploy step). Mirrors packages/server/src/db/migrate.ts.
package main

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/championswimmer/datacenter-tycoon/server-go/internal/db"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "Migration failed: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	url, ok := db.DatabaseURL(os.Getenv)
	if !ok {
		return fmt.Errorf("DATABASE_URL is required: the Go server has no PGlite fallback, so there is nothing to migrate without it")
	}
	res, err := db.MigrateDatabase(context.Background(), url)
	if err != nil {
		return err
	}
	if len(res.AppliedBaselineMigrations) == 0 {
		fmt.Printf("No pending baseline SQL migrations for %s/%s.\n", res.Mode, res.Provider)
		return nil
	}
	fmt.Printf("Applied baseline SQL migrations for %s/%s: %s\n", res.Mode, res.Provider, strings.Join(res.AppliedBaselineMigrations, ", "))
	return nil
}
