package httpserver

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/championswimmer/datacenter-tycoon/server-go/internal/config"
	"github.com/championswimmer/datacenter-tycoon/server-go/internal/ratelimit"
)

var jsonContentTypeRE = regexp.MustCompile(`(?i)^application/json(?:;\s?charset=utf-8)?$`)

func testConfig(t testing.TB, mutate ...func(*config.Config)) config.Config {
	t.Helper()
	cfg, err := config.Load(map[string]string{
		"NODE_ENV":             "test",
		"PORT":                 "4010",
		"HOST":                 "127.0.0.1",
		"CORS_ALLOWED_ORIGINS": "http://localhost:5173,http://localhost:4173",
		"SERVER_VERSION":       "9.9.9-test",
	})
	if err != nil {
		t.Fatal(err)
	}
	for _, m := range mutate {
		m(&cfg)
	}
	return cfg
}

// generousLimits mirrors the createContractTestApp rate limits used by the TS tests.
func generousLimits(c *config.Config) {
	c.RateLimits = config.RateLimits{
		BackendGlobal:         ratelimit.Rule{WindowMs: 1_000, MaxRequests: 100},
		PlayerRegistration:    ratelimit.Rule{WindowMs: 60_000, MaxRequests: 100},
		LeaderboardSubmission: ratelimit.Rule{WindowMs: 1_000, MaxRequests: 100},
	}
}

type denyAll struct{ retryAfter int64 }

func (d denyAll) Consume(string, string, ratelimit.Rule) ratelimit.Decision {
	return ratelimit.Decision{Allowed: false, RetryAfterSeconds: d.retryAfter}
}

type apiResult struct {
	Resp *http.Response
	Body string
	JSON map[string]any
}

type reqOpt func(*http.Request)

func withHeader(k, v string) reqOpt { return func(r *http.Request) { r.Header.Set(k, v) } }

var jsonHeader = withHeader("Content-Type", "application/json")

func do(t testing.TB, h http.Handler, method, path, body string, opts ...reqOpt) apiResult {
	t.Helper()
	var rdr io.Reader
	if body != "" {
		rdr = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, rdr)
	for _, o := range opts {
		o(req)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	resp := rec.Result()
	b, _ := io.ReadAll(resp.Body)
	res := apiResult{Resp: resp, Body: string(b)}
	if len(b) > 0 {
		_ = json.Unmarshal(b, &res.JSON)
	}
	return res
}

func get(t testing.TB, h http.Handler, path string, opts ...reqOpt) apiResult {
	return do(t, h, http.MethodGet, path, "", opts...)
}

func (r apiResult) assertStatus(t testing.TB, want int) {
	t.Helper()
	if r.Resp.StatusCode != want {
		t.Fatalf("status = %d, want %d (body %s)", r.Resp.StatusCode, want, r.Body)
	}
}

func (r apiResult) assertJSONContentType(t testing.TB) {
	t.Helper()
	if ct := r.Resp.Header.Get("Content-Type"); !jsonContentTypeRE.MatchString(ct) {
		t.Fatalf("content-type = %q", ct)
	}
}

// assertCurrentCORS mirrors assertCurrentCorsBehavior from the TS contract tests.
func (r apiResult) assertCurrentCORS(t testing.TB) {
	t.Helper()
	if v := r.Resp.Header.Get("Access-Control-Allow-Origin"); v != "" {
		t.Fatalf("allow-origin = %q, want absent", v)
	}
	if v := r.Resp.Header.Get("Access-Control-Allow-Credentials"); v != "true" {
		t.Fatalf("allow-credentials = %q", v)
	}
}

func (r apiResult) assertError(t testing.TB, status int, code string) map[string]any {
	t.Helper()
	r.assertStatus(t, status)
	r.assertJSONContentType(t)
	errObj, _ := r.JSON["error"].(map[string]any)
	if errObj["code"] != code {
		t.Fatalf("error code = %v, want %s (body %s)", errObj["code"], code, r.Body)
	}
	return errObj
}

func (r apiResult) message() string {
	e, _ := r.JSON["error"].(map[string]any)
	m, _ := e["message"].(string)
	return m
}

type fakeClock struct{ now time.Time }

func (c *fakeClock) Now() time.Time { return c.now }

var uuidV4RE = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
