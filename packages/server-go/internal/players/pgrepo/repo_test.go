package pgrepo_test

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/championswimmer/datacenter-tycoon/server-go/internal/db"
	"github.com/championswimmer/datacenter-tycoon/server-go/internal/db/dbtest"
	"github.com/championswimmer/datacenter-tycoon/server-go/internal/players"
	"github.com/championswimmer/datacenter-tycoon/server-go/internal/players/pgrepo"
)

func TestCreateLoadAndTouchPlayers(t *testing.T) {
	ctx := context.Background()
	repo := pgrepo.New(dbtest.NewMigratedPool(t))

	created, err := repo.CreatePlayer(ctx, players.RegisterPlayerInput{Username: "  Acme Cloud  "})
	if err != nil {
		t.Fatal(err)
	}
	if created.Username != "Acme Cloud" {
		t.Fatalf("username %q", created.Username)
	}
	byNorm, err := repo.FindByNormalizedUsername(ctx, "acme cloud")
	if err != nil || byNorm == nil || byNorm.PlayerID != created.PlayerID {
		t.Fatalf("by normalized: %+v %v", byNorm, err)
	}
	touchedAt := time.Date(2026, 5, 29, 12, 34, 56, 0, time.UTC)
	if err := repo.TouchPlayer(ctx, created.PlayerID, touchedAt); err != nil {
		t.Fatal(err)
	}
	touched, _ := repo.FindByPlayerID(ctx, created.PlayerID)
	if touched == nil || !touched.LastSeenAt.Equal(touchedAt) {
		t.Fatalf("touched: %+v", touched)
	}
	_, err = repo.CreatePlayer(ctx, players.RegisterPlayerInput{Username: "acme cloud"})
	var unavailable *players.UsernameUnavailableError
	if !errors.As(err, &unavailable) {
		t.Fatalf("expected UsernameUnavailableError, got %v", err)
	}
	var invalid *players.UsernameValidationError
	if _, err := repo.CreatePlayer(ctx, players.RegisterPlayerInput{Username: "x"}); !errors.As(err, &invalid) {
		t.Fatalf("expected validation error, got %v", err)
	}
	if p, err := repo.FindByPlayerID(ctx, "missing"); p != nil || err != nil {
		t.Fatalf("missing: %v %v", p, err)
	}
	if err := repo.TouchPlayer(ctx, "missing", time.Time{}); err != nil {
		t.Fatal(err)
	}
}

func TestConcurrentCreateYieldsSingleWinner(t *testing.T) {
	ctx := context.Background()
	repo := pgrepo.New(dbtest.NewMigratedPool(t))
	var wg sync.WaitGroup
	var mu sync.Mutex
	wins, losses := 0, 0
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := repo.CreatePlayer(ctx, players.RegisterPlayerInput{Username: "Racer"})
			mu.Lock()
			defer mu.Unlock()
			var u *players.UsernameUnavailableError
			switch {
			case err == nil:
				wins++
			case errors.As(err, &u):
				losses++
			default:
				t.Errorf("unexpected: %v", err)
			}
		}()
	}
	wg.Wait()
	if wins != 1 || losses != 7 {
		t.Fatalf("wins=%d losses=%d", wins, losses)
	}
}

// Port of pglite-persistence.test.ts: data survives closing and reopening the
// database connection after a migrate run.
func TestPlayerDataPersistsAcrossReopen(t *testing.T) {
	ctx := context.Background()
	url := dbtest.NewDatabaseURL(t)
	if _, err := db.MigrateDatabase(ctx, url); err != nil {
		t.Fatal(err)
	}
	first, err := db.Connect(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	created, err := pgrepo.New(first).CreatePlayer(ctx, players.RegisterPlayerInput{Username: "Persistent Cloud"})
	if err != nil {
		t.Fatal(err)
	}
	first.Close()

	second, err := db.Connect(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer second.Close()
	persisted, err := pgrepo.New(second).FindByPlayerID(ctx, created.PlayerID)
	if err != nil || persisted == nil || persisted.Username != "Persistent Cloud" {
		t.Fatalf("persisted: %+v %v", persisted, err)
	}
}
