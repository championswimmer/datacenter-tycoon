package config

import (
	"reflect"
	"strings"
	"testing"

	"github.com/championswimmer/datacenter-tycoon/server-go/internal/ratelimit"
)

func mustFail(t *testing.T, env map[string]string, substr string) {
	t.Helper()
	_, err := Load(env)
	if err == nil {
		t.Fatalf("expected error containing %q", substr)
	}
	if _, ok := err.(*Error); !ok {
		t.Fatalf("expected *Error, got %T", err)
	}
	if !strings.Contains(err.Error(), substr) {
		t.Fatalf("error %q lacks %q", err.Error(), substr)
	}
}

func TestRejectsMissingProductionCORS(t *testing.T) {
	mustFail(t, map[string]string{"NODE_ENV": "production", "PORT": "3000"}, "CORS_ALLOWED_ORIGINS")
}

func TestRejectsMissingProductionDatabaseURL(t *testing.T) {
	mustFail(t, map[string]string{"NODE_ENV": "production", "PORT": "3000", "CORS_ALLOWED_ORIGINS": "https://x.example"}, "DATABASE_URL")
}

func TestDevelopmentWithoutDatabaseURLUsesMemory(t *testing.T) {
	c, err := Load(map[string]string{"NODE_ENV": "development", "PORT": "3000", "CORS_ALLOWED_ORIGINS": "http://localhost:5173"})
	if err != nil {
		t.Fatal(err)
	}
	if c.Database.Mode != DatabaseModeMemory || c.DatabaseURL != "" {
		t.Fatalf("%+v", c.Database)
	}
}

func TestPrefersPostgresWhenDatabaseURLPresent(t *testing.T) {
	c, err := Load(map[string]string{"NODE_ENV": "development", "DATABASE_URL": "postgres://127.0.0.1:5432/dt"})
	if err != nil {
		t.Fatal(err)
	}
	if c.Database.Mode != DatabaseModePostgres || c.DatabaseURL != "postgres://127.0.0.1:5432/dt" {
		t.Fatalf("%+v", c)
	}
	if info := RuntimeInfo(c); !info.Configured || info.Provider != DatabaseProviderPgx {
		t.Fatalf("%+v", info)
	}
}

func TestAlwaysIncludesFirstPartyProductionOrigin(t *testing.T) {
	c, err := Load(map[string]string{
		"NODE_ENV": "production", "PORT": "3000", "DATABASE_URL": "postgres://127.0.0.1:5432/dt",
		"CORS_ALLOWED_ORIGINS": "https://dctycoon-api-production.up.railway.app",
	})
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"https://dctycoon-api-production.up.railway.app", "https://dctycoon.arnav.tech"}
	if !reflect.DeepEqual(c.CORSAllowedOrigins, want) {
		t.Fatalf("%v", c.CORSAllowedOrigins)
	}
}

func TestDefaults(t *testing.T) {
	c, err := Load(map[string]string{"NODE_ENV": "test"})
	if err != nil {
		t.Fatal(err)
	}
	if c.Port != 3000 || c.Host != "0.0.0.0" || c.ServerVersion != "0.1.0" {
		t.Fatalf("%+v", c)
	}
	if !reflect.DeepEqual(c.CORSAllowedOrigins, []string{"http://localhost:5173"}) {
		t.Fatalf("%v", c.CORSAllowedOrigins)
	}
	if c.RateLimits.BackendGlobal != (ratelimit.Rule{WindowMs: 1000, MaxRequests: 10}) ||
		c.RateLimits.PlayerRegistration != (ratelimit.Rule{WindowMs: 60000, MaxRequests: 10}) ||
		c.RateLimits.LeaderboardSubmission != (ratelimit.Rule{WindowMs: 1000, MaxRequests: 1}) {
		t.Fatalf("%+v", c.RateLimits)
	}
	want := LeaderboardVerification{"verified-run-v1", "leaderboard-ruleset-v1", 15, 1024, 262144}
	if c.LeaderboardVerification != want {
		t.Fatalf("%+v", c.LeaderboardVerification)
	}
}

func TestExplicitVerificationSettings(t *testing.T) {
	c, err := Load(map[string]string{
		"NODE_ENV": "test",
		"LEADERBOARD_VERIFICATION_PROTOCOL_VERSION":       "verified-run-v2",
		"LEADERBOARD_VERIFICATION_RULESET_ID":             "season-2026-07",
		"LEADERBOARD_VERIFICATION_MAX_TICK_DELTA":         "7",
		"LEADERBOARD_VERIFICATION_MAX_ACTION_COUNT":       "2048",
		"LEADERBOARD_VERIFICATION_MAX_REQUEST_BODY_BYTES": "524288",
	})
	if err != nil {
		t.Fatal(err)
	}
	want := LeaderboardVerification{"verified-run-v2", "season-2026-07", 7, 2048, 524288}
	if c.LeaderboardVerification != want {
		t.Fatalf("%+v", c.LeaderboardVerification)
	}
}

func TestRejectsInvalidSettings(t *testing.T) {
	mustFail(t, map[string]string{"NODE_ENV": "test", "LEADERBOARD_VERIFICATION_RULESET_ID": "bad ruleset id"}, "LEADERBOARD_VERIFICATION_RULESET_ID")
	mustFail(t, map[string]string{"NODE_ENV": "test", "LEADERBOARD_VERIFICATION_MAX_TICK_DELTA": "0"}, "LEADERBOARD_VERIFICATION_MAX_TICK_DELTA")
	mustFail(t, map[string]string{"NODE_ENV": "test", "BACKEND_RATE_LIMIT_MAX_REQUESTS": "0"}, "BACKEND_RATE_LIMIT_MAX_REQUESTS")
	mustFail(t, map[string]string{"NODE_ENV": "test", "BACKEND_RATE_LIMIT_WINDOW_MS": "1.5"}, "BACKEND_RATE_LIMIT_WINDOW_MS")
	mustFail(t, map[string]string{"NODE_ENV": "staging"}, "NODE_ENV must be one of")
	mustFail(t, map[string]string{"NODE_ENV": "test", "PORT": "70000"}, "PORT must be")
	mustFail(t, map[string]string{"NODE_ENV": "test", "PORT": "abc"}, "PORT must be")
}

func TestJSNumberQuirks(t *testing.T) {
	c, err := Load(map[string]string{"NODE_ENV": "test", "PORT": " 0x1F90 ", "BACKEND_RATE_LIMIT_MAX_REQUESTS": "1e2", "SERVER_VERSION": "  ", "npm_package_version": "3.2.1"})
	if err != nil {
		t.Fatal(err)
	}
	if c.Port != 8080 || c.RateLimits.BackendGlobal.MaxRequests != 100 || c.ServerVersion != "3.2.1" {
		t.Fatalf("%+v", c)
	}
}
