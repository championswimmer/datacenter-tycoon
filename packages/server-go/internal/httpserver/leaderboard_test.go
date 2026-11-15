package httpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/championswimmer/datacenter-tycoon/server-go/internal/config"
	"github.com/championswimmer/datacenter-tycoon/server-go/internal/leaderboard"
	"github.com/championswimmer/datacenter-tycoon/server-go/internal/players"
	"github.com/championswimmer/datacenter-tycoon/server-go/internal/ratelimit"
	"github.com/championswimmer/datacenter-tycoon/server-go/jsbridge"
)

var hash64RE = regexp.MustCompile(`^[a-f0-9]{64}$`)

func testEngine(t testing.TB) leaderboard.Engine {
	t.Helper()
	rt, err := jsbridge.Default()
	if err != nil {
		t.Fatal(err)
	}
	return rt
}

type lbEnv struct {
	players     players.PlayersRepository
	leaderboard leaderboard.LeaderboardRepository
	limiter     ratelimit.Limiter
	mutate      []func(*config.Config)
}

func (e lbEnv) app(t testing.TB) http.Handler {
	p := e.players
	if p == nil {
		p = players.NewInMemoryPlayersRepository()
	}
	l := e.leaderboard
	if l == nil {
		l = leaderboard.NewInMemoryLeaderboardRepository(nil)
	}
	return newApp(t, Dependencies{Players: p, Leaderboard: l, Engine: testEngine(t), RateLimiter: e.limiter},
		append([]func(*config.Config){generousLimits}, e.mutate...)...)
}

func registerPlayer(t testing.TB, h http.Handler, username string) string {
	t.Helper()
	res := do(t, h, http.MethodPost, "/players", fmt.Sprintf(`{"username":%q}`, username), jsonHeader)
	res.assertStatus(t, 201)
	return res.JSON["playerId"].(string)
}

func genesisPayload(playerID, clientRunID string) string {
	return fmt.Sprintf(`{"playerId":%q,"clientRunId":%q,"genesis":{"seed":42,"difficulty":"easy","rulesetId":"leaderboard-ruleset-v1"},"parentHeadHash":null,"actions":[]}`,
		playerID, clientRunID)
}

func submit(t testing.TB, h http.Handler, body string, opts ...reqOpt) apiResult {
	return do(t, h, http.MethodPost, "/leaderboard/runs", body, append([]reqOpt{jsonHeader}, opts...)...)
}

type seedRun struct {
	playerID, clientRunID                  string
	money, cumulativeRevenue, totalServers int64
	compute, memory, storage, gpu          int64
	gameMonth                              int
	submittedAt                            time.Time
	status                                 leaderboard.VerificationStatus
}

func seed(t testing.TB, repo leaderboard.LeaderboardRepository, in seedRun) {
	t.Helper()
	state, err := testEngine(t).Genesis(map[string]any{"seed": 42, "difficulty": "easy", "gameId": in.clientRunID, "playerName": "Seeded"})
	if err != nil {
		t.Fatal(err)
	}
	status := in.status
	if status == "" {
		status = leaderboard.VerificationVerified
	}
	pad := func(s, c string) string { return (s + strings.Repeat(c, 64))[:64] }
	_, err = repo.CommitVerifiedRun(context.Background(), leaderboard.CommitVerifiedRunInput{
		Run: leaderboard.CreateLeaderboardRunRecord(leaderboard.CreateLeaderboardRunInput{
			RunID: "placeholder-" + in.clientRunID, PlayerID: in.playerID, ClientRunID: in.clientRunID,
			VerificationStatus: status,
			Metrics: leaderboard.LeaderboardMetrics{
				Money: in.money, CumulativeRevenue: in.cumulativeRevenue, TotalServers: in.totalServers,
				ComputeCapacity: in.compute, MemoryCapacity: in.memory, StorageCapacity: in.storage, GpuCapacity: in.gpu,
			},
			GameMonth: in.gameMonth, SubmittedAt: in.submittedAt, UpdatedAt: in.submittedAt,
		}),
		Head: leaderboard.VerifiedLeaderboardRunHeadRecord{
			PlayerID: in.playerID, ClientRunID: in.clientRunID,
			ProtocolVersion: "verified-run-v1", RulesetID: "leaderboard-ruleset-v1",
			GenesisDescriptor:  json.RawMessage(fmt.Sprintf(`{"seed":42,"difficulty":"easy","gameId":%q,"playerName":"Seeded"}`, in.clientRunID)),
			RootHash:           pad(in.clientRunID+"-root", "0"),
			HeadHash:           pad(in.clientRunID+"-head", "1"),
			StateHash:          pad(in.clientRunID+"-state", "2"),
			LastRequestHash:    pad(in.clientRunID+"-request", "3"),
			AuthoritativeState: state,
			GameMonth:          in.gameMonth,
		},
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestSubmitStoresGenesisCheckpoint(t *testing.T) {
	h := lbEnv{}.app(t)
	id := registerPlayer(t, h, "Acme Cloud")
	res := submit(t, h, genesisPayload(id, "run-001"))
	res.assertStatus(t, 201)
	res.assertJSONContentType(t)
	if res.JSON["created"] != true || res.JSON["gameMonth"] != float64(0) {
		t.Fatal(res.Body)
	}
	if !hash64RE.MatchString(res.JSON["rootHash"].(string)) || !hash64RE.MatchString(res.JSON["headHash"].(string)) {
		t.Fatal(res.Body)
	}
	if res.JSON["metrics"].(map[string]any)["money"] != float64(8_000_000) {
		t.Fatal(res.Body)
	}
	if res.Resp.Header.Get("Retry-After") != "" {
		t.Fatal("unexpected Retry-After")
	}
	if !strings.HasPrefix(res.Body, `{"created":true,"rootHash":"`) {
		t.Fatalf("key order: %s", res.Body)
	}
}

func TestSubmitIsIdempotentForExactRetries(t *testing.T) {
	h := lbEnv{}.app(t)
	id := registerPlayer(t, h, "Acme Cloud")
	payload := genesisPayload(id, "run-duplicate")
	first := submit(t, h, payload)
	second := submit(t, h, payload)
	first.assertStatus(t, 201)
	second.assertStatus(t, 200)
	if second.JSON["created"] != false || second.JSON["headHash"] != first.JSON["headHash"] {
		t.Fatal(second.Body)
	}
}

func TestSubmitRejectsUnknownPlayer(t *testing.T) {
	h := lbEnv{}.app(t)
	submit(t, h, genesisPayload("player_missing", "run-404")).assertError(t, 404, "PLAYER_NOT_FOUND")
}

func TestSubmitRejectsRawSummaryPayloads(t *testing.T) {
	h := lbEnv{}.app(t)
	id := registerPlayer(t, h, "Acme Cloud")
	body := fmt.Sprintf(`{"playerId":%q,"clientRunId":"run-invalid","metrics":{"money":1},"gameMonth":1}`, id)
	submit(t, h, body).assertError(t, 400, "INVALID_VERIFIED_RUN")
}

func TestSubmitBodyErrors(t *testing.T) {
	h := lbEnv{}.app(t)
	e := submit(t, h, "{").assertError(t, 400, "INVALID_JSON")
	if e["message"] != "Request body must be valid JSON." {
		t.Fatal(e)
	}
	// An empty body and a literal null are both treated as a null payload.
	for _, body := range []string{"", "null"} {
		e = submit(t, h, body).assertError(t, 400, "INVALID_VERIFIED_RUN")
		if e["message"] != "Verified leaderboard submission must be a JSON object." {
			t.Fatalf("%q: %v", body, e)
		}
	}
}

func TestSubmitBodyLimit(t *testing.T) {
	h := lbEnv{mutate: []func(*config.Config){func(c *config.Config) { c.LeaderboardVerification.MaxRequestBodyBytes = 64 }}}.app(t)
	res := submit(t, h, `{"padding":"`+strings.Repeat("x", 100)+`"}`)
	e := res.assertError(t, 400, "INVALID_VERIFIED_RUN")
	if e["message"] != "Verified leaderboard submission body exceeds the limit of 64 bytes." {
		t.Fatal(e)
	}
	// Exactly at the limit is accepted by the transport (and then fails validation).
	exact := `{"p":"` + strings.Repeat("x", 64-8) + `"}`
	if len(exact) != 64 {
		t.Fatal(len(exact))
	}
	e = submit(t, h, exact).assertError(t, 400, "INVALID_VERIFIED_RUN")
	if strings.Contains(e["message"].(string), "exceeds the limit") {
		t.Fatal(e)
	}
}

func TestSubmitAdvancesAnExistingRun(t *testing.T) {
	h := lbEnv{}.app(t)
	id := registerPlayer(t, h, "Acme Cloud")
	first := submit(t, h, genesisPayload(id, "run-progress"))
	second := submit(t, h, fmt.Sprintf(`{"playerId":%q,"clientRunId":"run-progress","parentHeadHash":%q,"actions":[{"type":"Tick"}]}`,
		id, first.JSON["headHash"]))
	second.assertStatus(t, 200)
	if second.JSON["created"] != false || second.JSON["gameMonth"] != float64(1) || second.JSON["headHash"] == first.JSON["headHash"] {
		t.Fatal(second.Body)
	}
}

func TestSubmitVerifiesFullFifteenMonthCatchUp(t *testing.T) {
	h := lbEnv{}.app(t)
	id := registerPlayer(t, h, "Acme Cloud")
	genesis := submit(t, h, genesisPayload(id, "run-backlog"))
	actions := strings.TrimSuffix(strings.Repeat(`{"type":"Subtick"},`, 15*30), ",")
	res := submit(t, h, fmt.Sprintf(`{"playerId":%q,"clientRunId":"run-backlog","parentHeadHash":%q,"actions":[%s]}`,
		id, genesis.JSON["headHash"], actions))
	res.assertStatus(t, 200)
	if res.JSON["gameMonth"] != float64(15) {
		t.Fatal(res.Body)
	}
}

func TestSubmitRejectsStaleParentsAndOversizedTickGaps(t *testing.T) {
	h := lbEnv{}.app(t)
	id := registerPlayer(t, h, "Acme Cloud")
	first := submit(t, h, genesisPayload(id, "run-branch"))
	second := submit(t, h, fmt.Sprintf(`{"playerId":%q,"clientRunId":"run-branch","parentHeadHash":%q,"actions":[{"type":"Tick"}]}`, id, first.JSON["headHash"]))
	stale := submit(t, h, fmt.Sprintf(`{"playerId":%q,"clientRunId":"run-branch","parentHeadHash":%q,"actions":[]}`, id, first.JSON["headHash"]))
	tooFar := submit(t, h, fmt.Sprintf(`{"playerId":%q,"clientRunId":"run-branch","parentHeadHash":%q,"actions":[%s]}`,
		id, second.JSON["headHash"], strings.TrimSuffix(strings.Repeat(`{"type":"Tick"},`, 16), ",")))
	stale.assertError(t, 409, "STALE_RUN_HEAD")
	tooFar.assertError(t, 409, "RUN_TICK_GAP_EXCEEDED")
}

type brokenLeaderboard struct {
	leaderboard.LeaderboardRepository
}

func (brokenLeaderboard) CommitVerifiedRun(context.Context, leaderboard.CommitVerifiedRunInput) (*leaderboard.VerifiedRunCommitResult, error) {
	return nil, fmt.Errorf("database unavailable")
}

func TestSubmitRepositoryFailureIsInternalError(t *testing.T) {
	pr := players.NewInMemoryPlayersRepository()
	p, err := pr.CreatePlayer(context.Background(), players.RegisterPlayerInput{Username: "Acme Cloud"})
	if err != nil {
		t.Fatal(err)
	}
	h := lbEnv{players: pr, leaderboard: brokenLeaderboard{leaderboard.NewInMemoryLeaderboardRepository(nil)}}.app(t)
	res := submit(t, h, genesisPayload(p.PlayerID, "run-broken"))
	res.assertError(t, 500, "INTERNAL_SERVER_ERROR")
	if !strings.Contains(res.message(), "database unavailable") {
		t.Fatal(res.message())
	}
}

func TestSubmitRateLimits(t *testing.T) {
	pr := players.NewInMemoryPlayersRepository()
	p, _ := pr.CreatePlayer(context.Background(), players.RegisterPlayerInput{Username: "Rate Limited Cloud"})

	// Deny-all limiter: both global and route limits report the configured retry-after.
	h := lbEnv{players: pr, limiter: denyAllRouteOnly{}}.app(t)
	res := submit(t, h, genesisPayload(p.PlayerID, "run-limited"), withHeader("X-Forwarded-For", "198.51.100.24"))
	res.assertError(t, 429, "RATE_LIMITED")
	if res.message() != "Too many leaderboard submissions. Retry after 42 seconds." || res.Resp.Header.Get("Retry-After") != "" {
		t.Fatal(res.message())
	}
	res.assertCurrentCORS(t)

	// Real limiter with one submission per second per client IP.
	clock := &fakeClock{now: time.UnixMilli(10_000_000)}
	h = lbEnv{
		players: pr, limiter: ratelimit.NewInMemoryFixedWindowWithClock(clock.Now),
		mutate: []func(*config.Config){func(c *config.Config) {
			c.RateLimits.LeaderboardSubmission = ratelimit.Rule{WindowMs: 1_000, MaxRequests: 1}
		}},
	}.app(t)
	xff := func(ip string) reqOpt { return withHeader("X-Forwarded-For", ip) }
	first := submit(t, h, genesisPayload(p.PlayerID, "run-fast-1"), xff("198.51.100.24"))
	second := submit(t, h, genesisPayload(p.PlayerID, "run-fast-2"), xff("198.51.100.24"))
	third := submit(t, h, genesisPayload(p.PlayerID, "run-fast-3"), xff("198.51.100.25"))
	first.assertStatus(t, 201)
	second.assertError(t, 429, "RATE_LIMITED")
	if !strings.Contains(strings.ToLower(second.message()), "leaderboard submissions") {
		t.Fatal(second.message())
	}
	third.assertStatus(t, 201)
}

func TestSubmitRateLimitRunsBeforeBodyParsing(t *testing.T) {
	pr := players.NewInMemoryPlayersRepository()
	h := lbEnv{players: pr, limiter: denyAllRouteOnly{}}.app(t)
	submit(t, h, "not json").assertError(t, 429, "RATE_LIMITED")
}

func TestLeaderboardRankedEntriesContract(t *testing.T) {
	at := time.Date(2026, 5, 29, 12, 0, 0, 0, time.UTC)
	pr := players.NewInMemoryPlayersRepository()
	lr := leaderboard.NewInMemoryLeaderboardRepository(func() time.Time { return at })
	alpha, _ := pr.CreatePlayer(context.Background(), players.RegisterPlayerInput{Username: "Alpha Cloud"})
	beta, _ := pr.CreatePlayer(context.Background(), players.RegisterPlayerInput{Username: "Beta Cloud"})
	seed(t, lr, seedRun{playerID: alpha.PlayerID, clientRunID: "run-alpha", money: 1200, cumulativeRevenue: 2200, totalServers: 10, compute: 40, memory: 400, storage: 800, gameMonth: 12, submittedAt: at})
	seed(t, lr, seedRun{playerID: beta.PlayerID, clientRunID: "run-beta", money: 900, cumulativeRevenue: 1900, totalServers: 9, compute: 30, memory: 300, storage: 700, gameMonth: 11, submittedAt: at})

	h := lbEnv{players: pr, leaderboard: lr}.app(t)
	res := get(t, h, "/leaderboard?metric=money&period=all-time&limit=2")
	res.assertStatus(t, 200)
	res.assertJSONContentType(t)
	want := fmt.Sprintf(`{"metric":"money","period":"all-time","limit":2,"visibility":"verified","entries":[`+
		`{"rank":1,"playerId":%q,"username":"Alpha Cloud","metric":"money","value":1200,"submittedAt":"2026-05-29T12:00:00.000Z","gameMonth":12,"metrics":{"money":1200,"cumulativeRevenue":2200,"totalServers":10,"computeCapacity":40,"memoryCapacity":400,"storageCapacity":800,"gpuCapacity":0}},`+
		`{"rank":2,"playerId":%q,"username":"Beta Cloud","metric":"money","value":900,"submittedAt":"2026-05-29T12:00:00.000Z","gameMonth":11,"metrics":{"money":900,"cumulativeRevenue":1900,"totalServers":9,"computeCapacity":30,"memoryCapacity":300,"storageCapacity":700,"gpuCapacity":0}}]}`,
		alpha.PlayerID, beta.PlayerID)
	if res.Body != want {
		t.Fatalf("body mismatch\n got: %s\nwant: %s", res.Body, want)
	}

	get(t, h, "/leaderboard?metric=bogus").assertError(t, 400, "INVALID_LEADERBOARD_QUERY")
}

func TestLeaderboardEmptyEntriesIsArray(t *testing.T) {
	h := lbEnv{}.app(t)
	res := get(t, h, "/leaderboard")
	res.assertStatus(t, 200)
	if res.Body != `{"metric":"money","period":"all-time","limit":10,"visibility":"verified","entries":[]}` {
		t.Fatal(res.Body)
	}
	// Repeated parameters: the first value wins, like URLSearchParams.get.
	if get(t, h, "/leaderboard?metric=money&metric=x").Resp.StatusCode != 200 {
		t.Fatal("first value should win")
	}
}

func usernames(res apiResult) []string {
	var out []string
	for _, e := range res.JSON["entries"].([]any) {
		m := e.(map[string]any)
		out = append(out, fmt.Sprintf("%s=%v", m["username"], m["value"]))
	}
	return out
}

func TestLeaderboardTieBreakIsDeterministic(t *testing.T) {
	at := time.Date(2026, 5, 18, 12, 0, 0, 0, time.UTC)
	pr := players.NewInMemoryPlayersRepository()
	lr := leaderboard.NewInMemoryLeaderboardRepository(func() time.Time { return at })
	ctx := context.Background()
	alpha, _ := pr.CreatePlayer(ctx, players.RegisterPlayerInput{Username: "Alpha Cloud"})
	bravo, _ := pr.CreatePlayer(ctx, players.RegisterPlayerInput{Username: "Bravo Cloud"})
	seed(t, lr, seedRun{playerID: bravo.PlayerID, clientRunID: "bravo-run", money: 500, cumulativeRevenue: 500, totalServers: 5, compute: 10, memory: 20, storage: 30, gameMonth: 5, submittedAt: at})
	seed(t, lr, seedRun{playerID: alpha.PlayerID, clientRunID: "alpha-run", money: 500, cumulativeRevenue: 500, totalServers: 5, compute: 10, memory: 20, storage: 30, gameMonth: 5, submittedAt: at})
	h := lbEnv{players: pr, leaderboard: lr}.app(t)
	got := usernames(get(t, h, "/leaderboard?metric=money&period=all-time&limit=5"))
	if strings.Join(got, ",") != "Alpha Cloud=500,Bravo Cloud=500" {
		t.Fatal(got)
	}
}

func TestLeaderboardVisibility(t *testing.T) {
	at := time.Date(2026, 5, 17, 12, 0, 0, 0, time.UTC)
	pr := players.NewInMemoryPlayersRepository()
	lr := leaderboard.NewInMemoryLeaderboardRepository(func() time.Time { return at })
	ctx := context.Background()
	alpha, _ := pr.CreatePlayer(ctx, players.RegisterPlayerInput{Username: "Alpha Cloud"})
	beta, _ := pr.CreatePlayer(ctx, players.RegisterPlayerInput{Username: "Beta Cloud"})
	gamma, _ := pr.CreatePlayer(ctx, players.RegisterPlayerInput{Username: "Gamma Cloud"})
	seed(t, lr, seedRun{playerID: alpha.PlayerID, clientRunID: "run-alpha", money: 900, cumulativeRevenue: 900, totalServers: 9, compute: 90, memory: 90, storage: 90, gameMonth: 9, submittedAt: at})
	// Zero-revenue runs are excluded from the leaderboard.
	seed(t, lr, seedRun{playerID: gamma.PlayerID, clientRunID: "run-gamma", money: 5000, totalServers: 1, compute: 10, memory: 10, storage: 10, gameMonth: 6, submittedAt: at})
	seed(t, lr, seedRun{playerID: beta.PlayerID, clientRunID: "run-beta", money: 1200, cumulativeRevenue: 1200, totalServers: 12, compute: 120, memory: 120, storage: 120, gameMonth: 12, submittedAt: at, status: leaderboard.VerificationUnverified})

	h := lbEnv{players: pr, leaderboard: lr}.app(t)
	verified := get(t, h, "/leaderboard?metric=money&period=all-time&limit=5")
	verified.assertStatus(t, 200)
	if verified.JSON["visibility"] != "verified" || strings.Join(usernames(verified), ",") != "Alpha Cloud=900" {
		t.Fatal(verified.Body)
	}
	all := get(t, h, "/leaderboard?metric=money&period=all-time&limit=5&visibility=all")
	all.assertStatus(t, 200)
	if all.JSON["visibility"] != "all" || strings.Join(usernames(all), ",") != "Beta Cloud=1200,Alpha Cloud=900" {
		t.Fatal(all.Body)
	}
	for _, q := range []string{"metric=bogus&period=all-time&limit=10", "metric=money&period=all-time&limit=10&visibility=legacy"} {
		get(t, h, "/leaderboard?"+q).assertError(t, 400, "INVALID_LEADERBOARD_QUERY")
	}
}
