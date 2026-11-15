package httpserver

import (
	"context"
	"net/http"
	"testing"

	"github.com/championswimmer/datacenter-tycoon/server-go/internal/config"
	"github.com/championswimmer/datacenter-tycoon/server-go/internal/leaderboard"
	"github.com/championswimmer/datacenter-tycoon/server-go/internal/players"
	"github.com/championswimmer/datacenter-tycoon/server-go/internal/ratelimit"
)

func TestResolveDependenciesKeepsOverridesAndFillsGaps(t *testing.T) {
	factoryPlayers := players.NewInMemoryPlayersRepository()
	factoryLeaderboard := leaderboard.NewInMemoryLeaderboardRepository(nil)
	factoryLimiter := ratelimit.NewInMemoryFixedWindow()
	overrideLimiter := ratelimit.NewInMemoryFixedWindow()

	resolved := ResolveDependencies(
		Dependencies{RateLimiter: overrideLimiter},
		testConfig(t),
		func(config.Config) Dependencies {
			return Dependencies{Players: factoryPlayers, Leaderboard: factoryLeaderboard, RateLimiter: factoryLimiter}
		},
	)
	if resolved.Players != factoryPlayers || resolved.Leaderboard != factoryLeaderboard || resolved.RateLimiter != overrideLimiter {
		t.Fatalf("%+v", resolved)
	}
}

func TestDefaultServicesAreInMemoryEvenWithDatabaseURL(t *testing.T) {
	cfg := testConfig(t, func(c *config.Config) {
		c.Database = config.Database{Mode: config.DatabaseModePostgres, ConnectionString: "postgres://127.0.0.1:1/postgres"}
	})
	deps := DefaultServices(cfg)
	if _, ok := deps.Players.(*players.InMemoryPlayersRepository); !ok {
		t.Fatalf("%T", deps.Players)
	}
	if deps.Leaderboard == nil || deps.RateLimiter == nil || deps.Engine == nil {
		t.Fatalf("%+v", deps)
	}
}

func TestNewRuntimeServicesWithoutDatabaseUsesMemory(t *testing.T) {
	deps, err := NewRuntimeServices(context.Background(), testConfig(t))
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := deps.Players.(*players.InMemoryPlayersRepository); !ok || deps.Close != nil {
		t.Fatalf("%+v", deps)
	}
}

func TestNewRuntimeServicesFailsFastWhenPostgresUnreachable(t *testing.T) {
	cfg := testConfig(t, func(c *config.Config) {
		c.Database = config.Database{Mode: config.DatabaseModePostgres, ConnectionString: "postgres://127.0.0.1:1/postgres?connect_timeout=1"}
	})
	if _, err := NewRuntimeServices(context.Background(), cfg); err == nil {
		t.Fatal("expected connection error")
	}
}

func TestAppWithSwappedPersistenceFactory(t *testing.T) {
	cfg := testConfig(t)
	deps := ResolveDependencies(Dependencies{}, cfg, func(config.Config) Dependencies {
		return Dependencies{Players: players.NewInMemoryPlayersRepository(), RateLimiter: ratelimit.NewInMemoryFixedWindow()}
	})
	res := get(t, NewApp(deps, cfg), "/players/availability?username=Boundary%20Cloud")
	res.assertStatus(t, http.StatusOK)
	if res.Body != `{"username":"Boundary Cloud","available":true}` {
		t.Fatal(res.Body)
	}
}
