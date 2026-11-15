package httpserver

import (
	"context"

	"github.com/championswimmer/datacenter-tycoon/server-go/internal/config"
	"github.com/championswimmer/datacenter-tycoon/server-go/internal/db"
	"github.com/championswimmer/datacenter-tycoon/server-go/internal/leaderboard"
	lbpg "github.com/championswimmer/datacenter-tycoon/server-go/internal/leaderboard/pgrepo"
	"github.com/championswimmer/datacenter-tycoon/server-go/internal/players"
	playerspg "github.com/championswimmer/datacenter-tycoon/server-go/internal/players/pgrepo"
	"github.com/championswimmer/datacenter-tycoon/server-go/internal/ratelimit"
	"github.com/championswimmer/datacenter-tycoon/server-go/jsbridge"
)

// ServicesFactory builds default services for a config (mirrors ServerServicesFactory).
type ServicesFactory func(cfg config.Config) Dependencies

// ResolveDependencies fills every nil dependency from the factory output, keeping explicit
// overrides (mirrors resolveAppDependencies). Unlike the TS spread, an explicit nil cannot be told
// apart from "unset", so tests that want no rate limiter should use a factory that returns none.
func ResolveDependencies(deps Dependencies, cfg config.Config, factory ServicesFactory) Dependencies {
	if factory == nil {
		factory = DefaultServices
	}
	defaults := factory(cfg)
	if deps.Players == nil {
		deps.Players = defaults.Players
	}
	if deps.Leaderboard == nil {
		deps.Leaderboard = defaults.Leaderboard
	}
	if deps.Engine == nil {
		deps.Engine = defaults.Engine
	}
	if deps.RateLimiter == nil {
		deps.RateLimiter = defaults.RateLimiter
	}
	if deps.Close == nil {
		deps.Close = defaults.Close
	}
	return deps
}

// DefaultServices returns in-memory repositories plus a fresh in-memory rate limiter. It never
// touches the network, even when a DATABASE_URL is configured (use NewRuntimeServices for that).
func DefaultServices(config.Config) Dependencies {
	return Dependencies{
		Engine:      defaultEngine(),
		Players:     players.NewInMemoryPlayersRepository(),
		Leaderboard: leaderboard.NewInMemoryLeaderboardRepository(nil),
		RateLimiter: ratelimit.NewInMemoryFixedWindow(),
	}
}

// defaultEngine returns the shared jsbridge runtime, or nil when the bundle failed to load (the
// submit route then reports an internal error).
func defaultEngine() leaderboard.Engine {
	rt, err := jsbridge.Default()
	if err != nil {
		return nil
	}
	return rt
}

// NewRuntimeServices wires production services: pgx-backed repositories when DATABASE_URL is set,
// in-memory repositories otherwise. Rate limiting is always in-memory.
func NewRuntimeServices(ctx context.Context, cfg config.Config) (Dependencies, error) {
	if cfg.Database.Mode == config.DatabaseModePostgres && cfg.Database.ConnectionString != "" {
		pool, err := db.Connect(ctx, cfg.Database.ConnectionString)
		if err != nil {
			return Dependencies{}, err
		}
		return Dependencies{
			Engine:      defaultEngine(),
			Players:     playerspg.New(pool),
			Leaderboard: lbpg.New(pool),
			RateLimiter: ratelimit.NewInMemoryFixedWindow(),
			Close:       func(context.Context) error { pool.Close(); return nil },
		}, nil
	}
	return DefaultServices(cfg), nil
}
