package migrations

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

// The Go server reuses the TS server's migrations; both must stay identical so
// either server can migrate the same database.
func TestMigrationsMatchTypeScriptServer(t *testing.T) {
	tsDir := filepath.Join("..", "..", "server", "migrations")
	tsFiles, err := filepath.Glob(filepath.Join(tsDir, "*.sql"))
	if err != nil || len(tsFiles) == 0 {
		t.Skipf("TS migrations not found at %s", tsDir)
	}
	goFiles, _ := filepath.Glob("*.sql")
	if len(goFiles) != len(tsFiles) {
		t.Fatalf("migration file count differs: go=%d ts=%d", len(goFiles), len(tsFiles))
	}
	for _, ts := range tsFiles {
		want, _ := os.ReadFile(ts)
		got, err := os.ReadFile(filepath.Base(ts))
		if err != nil {
			t.Fatalf("missing %s: %v", filepath.Base(ts), err)
		}
		if !bytes.Equal(want, got) {
			t.Errorf("%s differs from packages/server/migrations", filepath.Base(ts))
		}
	}
	want, err := os.ReadFile(filepath.Join("..", "..", "server", "drizzle", "meta", "_journal.json"))
	if err != nil {
		t.Skip("TS drizzle journal not found")
	}
	got, _ := os.ReadFile(filepath.Join("drizzle", "meta", "_journal.json"))
	if !bytes.Equal(want, got) {
		t.Errorf("drizzle journal differs from packages/server/drizzle")
	}
}
