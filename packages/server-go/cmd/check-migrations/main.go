// Command check-migrations validates the embedded migrations. Mirrors
// packages/server/src/db/check-migrations.ts.
package main

import (
	"fmt"
	"os"

	"github.com/championswimmer/datacenter-tycoon/server-go/internal/db"
	"github.com/championswimmer/datacenter-tycoon/server-go/migrations"
)

func main() {
	n, err := db.ValidateMigrations(migrations.FS)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Migration validation failed: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("Validated %d legacy SQL migration file(s) and the Drizzle journal.\n", n)
}
