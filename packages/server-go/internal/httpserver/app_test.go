package httpserver

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/championswimmer/datacenter-tycoon/server-go/internal/config"
	"github.com/championswimmer/datacenter-tycoon/server-go/internal/players"
	"github.com/championswimmer/datacenter-tycoon/server-go/internal/ratelimit"
)

func newApp(t testing.TB, deps Dependencies, mutate ...func(*config.Config)) http.Handler {
	return NewApp(deps, testConfig(t, mutate...))
}

func TestCORSEchoesConfiguredOrigin(t *testing.T) {
	h := newApp(t, Dependencies{})
	res := get(t, h, "/healthz", withHeader("Origin", "http://localhost:5173"))
	res.assertStatus(t, 200)
	res.assertJSONContentType(t)
	if got := res.Resp.Header.Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
		t.Fatalf("allow-origin %q", got)
	}
	if res.Resp.Header.Get("Vary") != "Origin" || res.Resp.Header.Get("Access-Control-Allow-Methods") != "GET, POST, OPTIONS" ||
		res.Resp.Header.Get("Access-Control-Allow-Headers") != "content-type, x-forwarded-for" {
		t.Fatalf("headers %v", res.Resp.Header)
	}
}

func TestCORSIncludesFirstPartyProductionOrigin(t *testing.T) {
	cfg, err := config.Load(map[string]string{
		"NODE_ENV": "production", "CORS_ALLOWED_ORIGINS": "https://dctycoon-api-production.up.railway.app",
		"DATABASE_URL": "postgres://127.0.0.1:5432/dt",
	})
	if err != nil {
		t.Fatal(err)
	}
	h := NewApp(Dependencies{}, cfg)
	res := get(t, h, "/healthz", withHeader("Origin", "https://dctycoon.arnav.tech"))
	if got := res.Resp.Header.Get("Access-Control-Allow-Origin"); got != "https://dctycoon.arnav.tech" {
		t.Fatalf("allow-origin %q", got)
	}
}

func TestCORSUnknownOriginAndNoOrigin(t *testing.T) {
	h := newApp(t, Dependencies{})
	for _, opts := range [][]reqOpt{nil, {withHeader("Origin", "http://evil.example")}} {
		res := get(t, h, "/healthz", opts...)
		res.assertStatus(t, 200)
		res.assertCurrentCORS(t)
		if res.Resp.Header.Get("Vary") != "Origin" {
			t.Fatal("vary missing")
		}
	}
}

func TestPreflight(t *testing.T) {
	// Even a deny-all limiter does not affect OPTIONS.
	h := newApp(t, Dependencies{RateLimiter: denyAll{5}})
	res := do(t, h, http.MethodOptions, "/players", "",
		withHeader("Origin", "http://localhost:5173"),
		withHeader("Access-Control-Request-Method", "POST"),
		withHeader("Access-Control-Request-Headers", "content-type"))
	res.assertStatus(t, 204)
	hd := res.Resp.Header
	if hd.Get("Access-Control-Allow-Origin") != "http://localhost:5173" ||
		hd.Get("Access-Control-Allow-Methods") != "GET, POST, OPTIONS" ||
		hd.Get("Access-Control-Max-Age") != "5" ||
		hd.Get("Access-Control-Allow-Credentials") != "true" {
		t.Fatalf("headers %v", hd)
	}
	if !strings.Contains(hd.Get("Access-Control-Expose-Headers"), ",origin") || hd.Get("Content-Type") != "" || res.Body != "" {
		t.Fatalf("expose %q ct %q body %q", hd.Get("Access-Control-Expose-Headers"), hd.Get("Content-Type"), res.Body)
	}

	plain := do(t, h, http.MethodOptions, "/anything", "")
	plain.assertStatus(t, 204)
	if plain.Resp.Header.Get("Access-Control-Allow-Methods") != "" || plain.Resp.Header.Get("Access-Control-Allow-Origin") != "" {
		t.Fatalf("plain options headers %v", plain.Resp.Header)
	}
}

func TestNotFoundEnvelope(t *testing.T) {
	h := newApp(t, Dependencies{})
	res := get(t, h, "/missing")
	e := res.assertError(t, 404, "NOT_FOUND")
	if e["message"] != "No route matches GET /missing" {
		t.Fatalf("%v", e)
	}
	res.assertCurrentCORS(t)

	// Elysia answers unknown methods on known paths with the same NOT_FOUND envelope (no 405).
	res = do(t, h, http.MethodPost, "/healthz", "")
	if e := res.assertError(t, 404, "NOT_FOUND"); e["message"] != "No route matches POST /healthz" {
		t.Fatalf("%v", e)
	}
	get(t, h, "/players").assertError(t, 404, "NOT_FOUND")
	get(t, h, "/leaderboard/runs").assertError(t, 404, "NOT_FOUND")
	if e := get(t, h, "/").assertError(t, 404, "NOT_FOUND"); e["message"] != "No route matches GET /" {
		t.Fatalf("%v", e)
	}
}

func TestTrailingSlashAndHead(t *testing.T) {
	h := newApp(t, Dependencies{})
	get(t, h, "/healthz/").assertStatus(t, 200)
	res := do(t, h, http.MethodHead, "/healthz", "")
	res.assertStatus(t, 200)
	if res.Body != "" || res.Resp.Header.Get("Content-Length") == "" || res.Resp.Header.Get("Content-Length") == "0" {
		t.Fatalf("head: len=%q body=%q", res.Resp.Header.Get("Content-Length"), res.Body)
	}
	do(t, h, http.MethodHead, "/nope", "").assertStatus(t, 404)
}

func TestHealthz(t *testing.T) {
	h := newApp(t, Dependencies{RateLimiter: nil}, generousLimits)
	res := get(t, h, "/healthz")
	res.assertStatus(t, 200)
	res.assertJSONContentType(t)
	res.assertCurrentCORS(t)
	want := `{"status":"ok","environment":"test","runtime":"go","framework":"net/http","databaseMode":"memory","databaseProvider":"memory","databaseConfigured":false}`
	if res.Body != want {
		t.Fatalf("body %s", res.Body)
	}

	pg := newApp(t, Dependencies{}, func(c *config.Config) {
		c.Environment = config.EnvProduction
		c.Database = config.Database{Mode: config.DatabaseModePostgres, ConnectionString: "postgres://127.0.0.1:5432/dt"}
	})
	res = get(t, pg, "/healthz")
	if res.JSON["databaseMode"] != "postgres" || res.JSON["databaseProvider"] != "pgx" || res.JSON["databaseConfigured"] != true || res.JSON["environment"] != "production" {
		t.Fatalf("%s", res.Body)
	}
}

func TestVersion(t *testing.T) {
	h := newApp(t, Dependencies{})
	res := get(t, h, "/version")
	res.assertStatus(t, 200)
	res.assertJSONContentType(t)
	if res.Body != `{"serverVersion":"9.9.9-test","gameLogicVersion":"0.1.0"}` {
		t.Fatalf("%s", res.Body)
	}
}

func TestGlobalThrottleAfterTenRequestsPerSecond(t *testing.T) {
	clock := &fakeClock{now: time.UnixMilli(1_000_000)}
	h := newApp(t, Dependencies{RateLimiter: ratelimit.NewInMemoryFixedWindowWithClock(clock.Now)})
	for i := 0; i < 10; i++ {
		get(t, h, "/healthz").assertStatus(t, 200)
	}
	limited := get(t, h, "/healthz")
	limited.assertError(t, 429, "RATE_LIMITED")
	if !strings.Contains(strings.ToLower(limited.message()), "backend requests") {
		t.Fatal(limited.message())
	}
	if limited.message() != "Too many backend requests. Retry after 1 seconds." {
		t.Fatal(limited.message())
	}
	if limited.Resp.Header.Get("Retry-After") != "" {
		t.Fatal("Retry-After must not be set")
	}
	limited.assertCurrentCORS(t)
	// Not-found requests also consume the global limit.
	clock.now = clock.now.Add(time.Second)
	get(t, h, "/healthz").assertStatus(t, 200)
}

func TestDenyAllLimiterOnEveryRoute(t *testing.T) {
	h := newApp(t, Dependencies{RateLimiter: denyAll{42}})
	res := get(t, h, "/healthz")
	res.assertError(t, 429, "RATE_LIMITED")
	if !strings.Contains(res.message(), "backend requests") || res.Resp.Header.Get("Retry-After") != "" {
		t.Fatal(res.message())
	}
	res.assertCurrentCORS(t)
}

func TestPlayersUnavailableWithoutRepository(t *testing.T) {
	h := newApp(t, Dependencies{})
	e := get(t, h, "/players/availability?username=abc").assertError(t, 503, "PLAYERS_UNAVAILABLE")
	if e["message"] != "Player registration is not configured." {
		t.Fatal(e)
	}
	do(t, h, http.MethodPost, "/players", `{"username":"abcd"}`, jsonHeader).assertError(t, 503, "PLAYERS_UNAVAILABLE")
	e = get(t, h, "/leaderboard").assertError(t, 503, "LEADERBOARD_UNAVAILABLE")
	if e["message"] != "Online leaderboard submission is not configured." {
		t.Fatal(e)
	}
	do(t, h, http.MethodPost, "/leaderboard/runs", `{}`, jsonHeader).assertError(t, 503, "LEADERBOARD_UNAVAILABLE")
}

func playersApp(t testing.TB, repo players.PlayersRepository, limiter ratelimit.Limiter) http.Handler {
	return newApp(t, Dependencies{Players: repo, RateLimiter: limiter}, generousLimits)
}

func TestAvailability(t *testing.T) {
	h := playersApp(t, players.NewInMemoryPlayersRepository(), nil)
	res := get(t, h, "/players/availability?username=Acme%20Cloud")
	res.assertStatus(t, 200)
	res.assertJSONContentType(t)
	if res.Body != `{"username":"Acme Cloud","available":true}` {
		t.Fatal(res.Body)
	}

	do(t, h, http.MethodPost, "/players", `{"username":"Acme Cloud"}`, jsonHeader).assertStatus(t, 201)
	res = get(t, h, "/players/availability?username=++acme+++cloud++")
	if res.Body != `{"username":"acme cloud","available":false}` {
		t.Fatal(res.Body)
	}

	get(t, h, "/players/availability?username=%20%20").assertError(t, 400, "INVALID_USERNAME")
	e := get(t, h, "/players/availability").assertError(t, 400, "INVALID_USERNAME")
	if e["message"] != "username query parameter is required." {
		t.Fatal(e)
	}
	// Present-but-empty goes through username validation.
	e = get(t, h, "/players/availability?username=").assertError(t, 400, "INVALID_USERNAME")
	if e["message"] != "Username must be at least 3 characters long." {
		t.Fatal(e)
	}
	// Invalid percent-escapes are kept literally, like URLSearchParams.
	res = get(t, h, "/players/availability?username=100%25%zz")
	if res.Resp.StatusCode == 500 {
		t.Fatal(res.Body)
	}
}

func TestRegisterPlayer(t *testing.T) {
	h := playersApp(t, players.NewInMemoryPlayersRepository(), nil)
	res := do(t, h, http.MethodPost, "/players", `{"username":"  Acme Cloud  "}`, jsonHeader)
	res.assertStatus(t, 201)
	res.assertJSONContentType(t)
	if res.JSON["username"] != "Acme Cloud" {
		t.Fatal(res.Body)
	}
	if id, _ := res.JSON["playerId"].(string); !uuidV4RE.MatchString(id) {
		t.Fatalf("playerId %q", id)
	}
	if !strings.HasPrefix(res.Body, `{"playerId":"`) {
		t.Fatalf("key order: %s", res.Body)
	}

	dup := do(t, h, http.MethodPost, "/players", `{"username":"  acme   cloud  "}`, jsonHeader)
	dup.assertError(t, 409, "USERNAME_UNAVAILABLE")
	if !strings.Contains(dup.message(), "already taken") || !strings.Contains(dup.message(), "choose another one") && !strings.Contains(dup.message(), "Choose another one") {
		t.Fatal(dup.message())
	}

	do(t, h, http.MethodPost, "/players", `{"username":"!!"}`, jsonHeader).assertError(t, 400, "INVALID_USERNAME")
}

func TestRegisterPlayerBodyErrors(t *testing.T) {
	h := playersApp(t, players.NewInMemoryPlayersRepository(), nil)
	for _, body := range []string{"not-json", "", "{", "  "} {
		res := do(t, h, http.MethodPost, "/players", body, jsonHeader)
		e := res.assertError(t, 400, "INVALID_JSON")
		if e["message"] != "Request body must be valid JSON." || res.Resp.Header.Get("Retry-After") != "" {
			t.Fatal(e)
		}
		res.assertCurrentCORS(t)
	}
	for _, body := range []string{"[]", "null", "5", `"x"`, `{"username":5}`, `{}`, "false"} {
		e := do(t, h, http.MethodPost, "/players", body, jsonHeader).assertError(t, 400, "INVALID_USERNAME")
		if e["message"] != "Request body must include a username string." {
			t.Fatalf("%s: %v", body, e)
		}
	}
	// Content-Type is not consulted (Elysia route has no body schema).
	do(t, h, http.MethodPost, "/players", `{"username":"abcd"}`).assertStatus(t, 201)
	do(t, h, http.MethodPost, "/players", "\xEF\xBB\xBF"+`{"username":"abcde"}`, withHeader("Content-Type", "text/plain")).assertStatus(t, 201)
}

type brokenPlayers struct{ players.PlayersRepository }

func (brokenPlayers) CreatePlayer(_ context.Context, _ players.RegisterPlayerInput) (*players.RegisteredPlayer, error) {
	return nil, errors.New("database unavailable")
}

func TestRegisterPersistenceFailureIs500(t *testing.T) {
	h := playersApp(t, brokenPlayers{players.NewInMemoryPlayersRepository()}, nil)
	res := do(t, h, http.MethodPost, "/players", `{"username":"Acme Cloud"}`, jsonHeader)
	res.assertError(t, 500, "INTERNAL_SERVER_ERROR")
	if !strings.Contains(res.message(), "database unavailable") {
		t.Fatal(res.message())
	}
}

func TestRegistrationRateLimit(t *testing.T) {
	h := playersApp(t, players.NewInMemoryPlayersRepository(), denyAllRouteOnly{})
	res := do(t, h, http.MethodPost, "/players", `{"username":"Acme Cloud"}`, jsonHeader, withHeader("X-Forwarded-For", "203.0.113.10"))
	res.assertError(t, 429, "RATE_LIMITED")
	if res.message() != "Too many player registrations. Retry after 42 seconds." || res.Resp.Header.Get("Retry-After") != "" {
		t.Fatal(res.message())
	}
	res.assertCurrentCORS(t)
}

// denyAllRouteOnly allows the global bucket and denies route-level buckets.
type denyAllRouteOnly struct{}

func (denyAllRouteOnly) Consume(scope, _ string, _ ratelimit.Rule) ratelimit.Decision {
	if scope == "backend requests" {
		return ratelimit.Decision{Allowed: true}
	}
	return ratelimit.Decision{Allowed: false, RetryAfterSeconds: 42}
}

func TestPerClientRegistrationLimitUsesForwardedFor(t *testing.T) {
	clock := &fakeClock{now: time.UnixMilli(5_000_000)}
	h := newApp(t, Dependencies{
		Players:     players.NewInMemoryPlayersRepository(),
		RateLimiter: ratelimit.NewInMemoryFixedWindowWithClock(clock.Now),
	}, func(c *config.Config) {
		generousLimits(c)
		c.RateLimits.PlayerRegistration = ratelimit.Rule{WindowMs: 60_000, MaxRequests: 1}
	})
	post := func(name, ip string) apiResult {
		return do(t, h, http.MethodPost, "/players", `{"username":"`+name+`"}`, jsonHeader, withHeader("X-Forwarded-For", ip))
	}
	post("first-user", "198.51.100.1").assertStatus(t, 201)
	limited := post("second-user", "198.51.100.1")
	limited.assertError(t, 429, "RATE_LIMITED")
	if limited.message() != "Too many player registrations. Retry after 60 seconds." {
		t.Fatal(limited.message())
	}
	post("third-user", "198.51.100.2").assertStatus(t, 201)
}

func TestPanicBecomesInternalError(t *testing.T) {
	h := playersApp(t, panicPlayers{}, nil)
	res := get(t, h, "/players/availability?username=abc")
	res.assertError(t, 500, "INTERNAL_SERVER_ERROR")
}

type panicPlayers struct{ players.PlayersRepository }

func (panicPlayers) FindByNormalizedUsername(context.Context, string) (*players.RegisteredPlayer, error) {
	panic("boom")
}

func TestHTTPErrorsAreMappedAndUnknownErrorsAre500(t *testing.T) {
	status, code, msg := resolveError(NewHTTPError(418, "BREW_FAILURE", "Short and stout."))
	if status != 418 || code != "BREW_FAILURE" || msg != "Short and stout." {
		t.Fatal(status, code, msg)
	}
	status, code, msg = resolveError(errors.New("boom"))
	if status != 500 || code != "INTERNAL_SERVER_ERROR" || msg != "boom" {
		t.Fatal(status, code, msg)
	}
}

func TestParseSearchParams(t *testing.T) {
	v := parseSearchParams("a=1&a=2&b&c=%41%zz+x&&=e")
	if v["a"][0] != "1" || len(v["a"]) != 2 {
		t.Fatal(v)
	}
	if got, ok := v["b"]; !ok || got[0] != "" {
		t.Fatal(v)
	}
	if v["c"][0] != "A%zz x" {
		t.Fatalf("%q", v["c"][0])
	}
}
