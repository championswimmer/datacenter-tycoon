package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/championswimmer/datacenter-tycoon/server-go/internal/config"
	"github.com/championswimmer/datacenter-tycoon/server-go/internal/leaderboard"
	"github.com/championswimmer/datacenter-tycoon/server-go/internal/players"
	"github.com/championswimmer/datacenter-tycoon/server-go/internal/ratelimit"
)

// Dependencies are the already-resolved services the transport needs. Nil repositories make the
// related routes answer 503; a nil RateLimiter disables all throttling (as in the TS server).
type Dependencies struct {
	Players     players.PlayersRepository
	Leaderboard leaderboard.LeaderboardRepository
	// Engine is the game-logic runtime (jsbridge) used to verify leaderboard submissions.
	Engine      leaderboard.Engine
	RateLimiter ratelimit.Limiter
	// Close releases underlying resources (database pools). May be nil.
	Close func(ctx context.Context) error
}

type app struct {
	deps Dependencies
	cfg  config.Config
	cors *corsPolicy
	// routes maps "METHOD path" to a handler; HEAD is served by GET handlers.
	routes map[string]routeFunc
}

type routeFunc func(w http.ResponseWriter, r *http.Request) error

// NewApp builds the HTTP handler. It performs no I/O.
func NewApp(deps Dependencies, cfg config.Config) http.Handler {
	a := &app{deps: deps, cfg: cfg, cors: newCORSPolicy(cfg.CORSAllowedOrigins)}
	a.routes = map[string]routeFunc{
		"GET /healthz":              a.health,
		"GET /version":              a.version,
		"GET /players/availability": a.playerAvailability,
		"POST /players":             a.registerPlayer,
		"GET /leaderboard":          a.leaderboardList,
		"POST /leaderboard/runs":    a.leaderboardSubmit,
	}
	return a
}

func (a *app) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	defer func() {
		if rec := recover(); rec != nil {
			if rec == http.ErrAbortHandler {
				panic(rec)
			}
			writeError(w, r, panicToError(rec))
		}
	}()

	preflight := a.cors.apply(w.Header(), r)
	if preflight {
		// Handled by the CORS plugin before rate limiting and routing.
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if a.deps.RateLimiter != nil {
		if err := a.enforceRateLimit(r, "backend requests", "global", a.cfg.RateLimits.BackendGlobal); err != nil {
			writeError(w, r, err)
			return
		}
	}

	path := r.URL.Path
	if len(path) > 1 {
		path = strings.TrimSuffix(path, "/")
	}
	method := r.Method
	if method == http.MethodHead {
		method = http.MethodGet
	}
	handler, ok := a.routes[method+" "+path]
	if !ok {
		writeJSON(w, r, http.StatusNotFound, CreateErrorBody(
			"NOT_FOUND",
			fmt.Sprintf("No route matches %s %s", r.Method, r.URL.EscapedPath()),
		))
		return
	}
	if err := handler(w, r); err != nil {
		writeError(w, r, err)
	}
}

// enforceRateLimit consumes from the limiter. The global scope uses the fixed key "global"; route
// scopes pass a per-client key (see enforceClientRateLimit).
func (a *app) enforceRateLimit(_ *http.Request, resource, key string, rule ratelimit.Rule) error {
	decision := a.deps.RateLimiter.Consume(resource, key, rule)
	if !decision.Allowed {
		return NewHTTPError(429, "RATE_LIMITED", fmt.Sprintf(
			"Too many %s. Retry after %d seconds.", resource, decision.RetryAfterSeconds))
	}
	return nil
}

func (a *app) enforceClientRateLimit(r *http.Request, resource string, rule ratelimit.Rule) error {
	return a.enforceRateLimit(r, resource, ratelimit.ClientKey(r), rule)
}

// parseSearchParams mimics WHATWG URLSearchParams: '+' is a space, invalid percent escapes are kept
// literally (Go's url.ParseQuery would reject the pair), empty pairs are skipped.
func parseSearchParams(rawQuery string) url.Values {
	values := url.Values{}
	for _, pair := range strings.Split(rawQuery, "&") {
		if pair == "" {
			continue
		}
		name, value, _ := strings.Cut(pair, "=")
		n, v := lenientDecode(name), lenientDecode(value)
		values[n] = append(values[n], v)
	}
	return values
}

func lenientDecode(s string) string {
	s = strings.ReplaceAll(s, "+", " ")
	if !strings.Contains(s, "%") {
		return s
	}
	var b bytes.Buffer
	for i := 0; i < len(s); i++ {
		if s[i] == '%' && i+2 < len(s)+0 && isHex(s[i+1]) && isHex(s[i+2]) {
			n, _ := strconv.ParseUint(s[i+1:i+3], 16, 8)
			b.WriteByte(byte(n))
			i += 2
			continue
		}
		b.WriteByte(s[i])
	}
	return strings.ToValidUTF8(b.String(), "�")
}

func isHex(c byte) bool {
	return c >= '0' && c <= '9' || c >= 'a' && c <= 'f' || c >= 'A' && c <= 'F'
}

var utf8BOM = []byte{0xEF, 0xBB, 0xBF}

// readBody reads at most limit+1 bytes (so callers can detect overflow) and strips a UTF-8 BOM the
// way Request.text()/json() do.
func readBody(r *http.Request, limit int64) ([]byte, error) {
	body, err := io.ReadAll(io.LimitReader(r.Body, limit+1))
	if err != nil {
		return nil, err
	}
	return bytes.TrimPrefix(body, utf8BOM), nil
}

func invalidJSON() error {
	return NewHTTPError(400, "INVALID_JSON", "Request body must be valid JSON.")
}

// decodeJSON is JSON.parse: the whole input must be exactly one JSON value.
func decodeJSON(body []byte) (any, error) {
	var v any
	if err := json.Unmarshal(body, &v); err != nil {
		return nil, err
	}
	return v, nil
}
