// Package config ports packages/server/src/config.ts (environment parsing).
package config

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"

	"github.com/championswimmer/datacenter-tycoon/server-go/internal/ratelimit"
)

type Environment string

const (
	EnvDevelopment Environment = "development"
	EnvTest        Environment = "test"
	EnvProduction  Environment = "production"
)

// DatabaseMode / DatabaseProvider are the values reported by /healthz. The TS server reports
// pglite variants for non-Postgres runs; Go has no PGlite so it reports in-memory storage.
type DatabaseMode string
type DatabaseProvider string

const (
	DatabaseModePostgres DatabaseMode = "postgres"
	DatabaseModeMemory   DatabaseMode = "memory"

	DatabaseProviderPgx    DatabaseProvider = "pgx"
	DatabaseProviderMemory DatabaseProvider = "memory"
)

var (
	DefaultDevCORSAllowedOrigins           = []string{"http://localhost:5173"}
	FirstPartyProductionCORSAllowedOrigins = []string{
		"https://dctycoon.arnav.tech",
		"https://dctycoon-3d.up.railway.app",
	}
	defaultServerVersion                   = "0.1.0"
	// DefaultGameLogicVersion is overridden by main with the bundle's VERSION (jsbridge).
	DefaultGameLogicVersion = "0.1.0"
)

type RateLimits struct {
	BackendGlobal         ratelimit.Rule
	PlayerRegistration    ratelimit.Rule
	LeaderboardSubmission ratelimit.Rule
}

type Database struct {
	Mode             DatabaseMode
	ConnectionString string
}

type LeaderboardVerification struct {
	ProtocolVersion     string
	RulesetID           string
	MaxTickDelta        int64
	MaxActionCount      int64
	MaxRequestBodyBytes int64
}

type Config struct {
	Environment             Environment
	Host                    string
	Port                    int
	CORSAllowedOrigins      []string
	Database                Database
	DatabaseURL             string // empty unless Database.Mode == postgres
	RateLimits              RateLimits
	LeaderboardVerification LeaderboardVerification
	ServerVersion           string
	GameLogicVersion        string
}

type DatabaseRuntimeInfo struct {
	Mode       DatabaseMode
	Provider   DatabaseProvider
	Configured bool
}

// Error is the equivalent of ConfigError.
type Error struct{ Message string }

func (e *Error) Error() string { return e.Message }

func errorf(format string, a ...any) error { return &Error{Message: fmt.Sprintf(format, a...)} }

// Load parses a config from an env map (see os.Environ helper FromOS).
func Load(env map[string]string) (Config, error) {
	environment, err := parseEnvironment(env, "NODE_ENV")
	if err != nil {
		return Config{}, err
	}
	port, err := parsePort(env["PORT"])
	if err != nil {
		return Config{}, err
	}
	host := strings.TrimSpace(env["HOST"])
	if host == "" {
		host = "0.0.0.0"
	}
	cors, err := parseCORS(environment, env["CORS_ALLOWED_ORIGINS"])
	if err != nil {
		return Config{}, err
	}
	db, err := parseDatabase(environment, env)
	if err != nil {
		return Config{}, err
	}

	rule := func(prefix string, windowDefault, maxDefault int64) (ratelimit.Rule, error) {
		w, err := parsePositiveInteger(env[prefix+"_WINDOW_MS"], windowDefault, prefix+"_WINDOW_MS")
		if err != nil {
			return ratelimit.Rule{}, err
		}
		m, err := parsePositiveInteger(env[prefix+"_MAX_REQUESTS"], maxDefault, prefix+"_MAX_REQUESTS")
		if err != nil {
			return ratelimit.Rule{}, err
		}
		return ratelimit.Rule{WindowMs: w, MaxRequests: m}, nil
	}

	var cfg Config
	var rl RateLimits
	if rl.BackendGlobal, err = rule("BACKEND_RATE_LIMIT", 1_000, 10); err != nil {
		return Config{}, err
	}
	if rl.PlayerRegistration, err = rule("PLAYER_REGISTRATION_RATE_LIMIT", 60_000, 10); err != nil {
		return Config{}, err
	}
	if rl.LeaderboardSubmission, err = rule("LEADERBOARD_SUBMISSION_RATE_LIMIT", 1_000, 1); err != nil {
		return Config{}, err
	}

	var v LeaderboardVerification
	if v.ProtocolVersion, err = parseRequiredConfigString(env["LEADERBOARD_VERIFICATION_PROTOCOL_VERSION"], "verified-run-v1", "LEADERBOARD_VERIFICATION_PROTOCOL_VERSION"); err != nil {
		return Config{}, err
	}
	if v.RulesetID, err = parseRequiredConfigString(env["LEADERBOARD_VERIFICATION_RULESET_ID"], "leaderboard-ruleset-v1", "LEADERBOARD_VERIFICATION_RULESET_ID"); err != nil {
		return Config{}, err
	}
	if v.MaxTickDelta, err = parsePositiveInteger(env["LEADERBOARD_VERIFICATION_MAX_TICK_DELTA"], 15, "LEADERBOARD_VERIFICATION_MAX_TICK_DELTA"); err != nil {
		return Config{}, err
	}
	if v.MaxActionCount, err = parsePositiveInteger(env["LEADERBOARD_VERIFICATION_MAX_ACTION_COUNT"], 1_024, "LEADERBOARD_VERIFICATION_MAX_ACTION_COUNT"); err != nil {
		return Config{}, err
	}
	if v.MaxRequestBodyBytes, err = parsePositiveInteger(env["LEADERBOARD_VERIFICATION_MAX_REQUEST_BODY_BYTES"], 262_144, "LEADERBOARD_VERIFICATION_MAX_REQUEST_BODY_BYTES"); err != nil {
		return Config{}, err
	}

	serverVersion := strings.TrimSpace(env["SERVER_VERSION"])
	if serverVersion == "" {
		serverVersion = strings.TrimSpace(env["npm_package_version"])
	}
	if serverVersion == "" {
		serverVersion = defaultServerVersion
	}

	cfg = Config{
		Environment:             environment,
		Host:                    host,
		Port:                    port,
		CORSAllowedOrigins:      cors,
		Database:                db,
		RateLimits:              rl,
		LeaderboardVerification: v,
		ServerVersion:           serverVersion,
		GameLogicVersion:        DefaultGameLogicVersion,
	}
	if db.Mode == DatabaseModePostgres {
		cfg.DatabaseURL = db.ConnectionString
	}
	return cfg, nil
}

// RuntimeInfo mirrors getServerDatabaseRuntimeInfo.
func RuntimeInfo(c Config) DatabaseRuntimeInfo {
	if c.Database.Mode == DatabaseModePostgres {
		return DatabaseRuntimeInfo{Mode: DatabaseModePostgres, Provider: DatabaseProviderPgx, Configured: c.Database.ConnectionString != ""}
	}
	return DatabaseRuntimeInfo{Mode: DatabaseModeMemory, Provider: DatabaseProviderMemory, Configured: false}
}

func parseEnvironment(env map[string]string, key string) (Environment, error) {
	value, present := env[key]
	if !present || value == "development" {
		return EnvDevelopment, nil
	}
	switch value {
	case "test":
		return EnvTest, nil
	case "production":
		return EnvProduction, nil
	}
	return "", errorf("NODE_ENV must be one of development, test, or production. Received: %s", value)
}

func parsePort(value string) (int, error) {
	if strings.TrimSpace(value) == "" {
		return 3000, nil
	}
	n, ok := jsInteger(value)
	if !ok || n < 1 || n > 65535 {
		return 0, errorf("PORT must be an integer between 1 and 65535. Received: %s", value)
	}
	return int(n), nil
}

func parseCORS(environment Environment, raw string) ([]string, error) {
	var origins []string
	for _, part := range strings.Split(raw, ",") {
		if p := strings.TrimSpace(part); p != "" {
			origins = append(origins, p)
		}
	}
	if len(origins) > 0 {
		if environment == EnvProduction {
			return dedupe(append(origins, FirstPartyProductionCORSAllowedOrigins...)), nil
		}
		return dedupe(origins), nil
	}
	if environment == EnvProduction {
		return nil, errorf("CORS_ALLOWED_ORIGINS is required in production.")
	}
	return append([]string(nil), DefaultDevCORSAllowedOrigins...), nil
}

func dedupe(in []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(in))
	for _, s := range in {
		if !seen[s] {
			seen[s] = true
			out = append(out, s)
		}
	}
	return out
}

func parseDatabase(environment Environment, env map[string]string) (Database, error) {
	if url := strings.TrimSpace(env["DATABASE_URL"]); url != "" {
		return Database{Mode: DatabaseModePostgres, ConnectionString: url}, nil
	}
	if environment == EnvProduction {
		return Database{}, errorf("DATABASE_URL is required in production.")
	}
	return Database{Mode: DatabaseModeMemory}, nil
}

var configStringRE = regexp.MustCompile(`^[A-Za-z0-9._:-]{1,128}$`)

func parseRequiredConfigString(value, def, field string) (string, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return def, nil
	}
	if !configStringRE.MatchString(trimmed) {
		return "", errorf("%s must be 1-128 characters of letters, numbers, periods, underscores, colons, or hyphens. Received: %s", field, value)
	}
	return trimmed, nil
}

func parsePositiveInteger(value string, def int64, field string) (int64, error) {
	if strings.TrimSpace(value) == "" {
		return def, nil
	}
	n, ok := jsInteger(value)
	if !ok || n < 1 {
		return 0, errorf("%s must be a positive integer. Received: %s", field, value)
	}
	return n, nil
}

var (
	decimalRE = regexp.MustCompile(`^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$`)
	prefixRE  = regexp.MustCompile(`^0([xX][0-9a-fA-F]+|[bB][01]+|[oO][0-7]+)$`)
)

// jsInteger approximates `Number(value)` followed by Number.isInteger (JS trims whitespace,
// accepts exponent notation and 0x/0b/0o prefixes). Values beyond 2^53 are rejected-as-safe.
func jsInteger(value string) (int64, bool) {
	s := strings.TrimSpace(value)
	if s == "" {
		return 0, true // Number("") === 0 (callers reject empty earlier)
	}
	var f float64
	switch {
	case prefixRE.MatchString(s):
		u, err := strconv.ParseUint(s[2:], map[byte]int{'x': 16, 'X': 16, 'b': 2, 'B': 2, 'o': 8, 'O': 8}[s[1]], 64)
		if err != nil {
			return 0, false
		}
		f = float64(u)
	case decimalRE.MatchString(s):
		var err error
		f, err = strconv.ParseFloat(s, 64)
		if err != nil {
			return 0, false
		}
	default:
		return 0, false
	}
	if math.IsInf(f, 0) || math.IsNaN(f) || f != math.Trunc(f) || math.Abs(f) > 1<<53 {
		return 0, false
	}
	return int64(f), true
}
