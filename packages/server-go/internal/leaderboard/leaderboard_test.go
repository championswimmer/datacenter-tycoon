package leaderboard

import (
	"context"
	"encoding/json"
	"errors"
	"net/url"
	"os"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/championswimmer/datacenter-tycoon/server-go/internal/players"
	"github.com/championswimmer/datacenter-tycoon/server-go/jsbridge"
)

func decode(t *testing.T, s string) any {
	t.Helper()
	v, err := DecodeJSON([]byte(s))
	if err != nil {
		t.Fatal(err)
	}
	return v
}

func validationMsg(t *testing.T, body string) string {
	t.Helper()
	_, err := ParseVerifiedRunCheckpointSubmission(decode(t, body))
	var ve *ValidationError
	if !errors.As(err, &ve) {
		t.Fatalf("expected ValidationError for %s, got %v", body, err)
	}
	if ve.Code != "INVALID_VERIFIED_RUN" {
		t.Fatal(ve.Code)
	}
	return ve.Message
}

func TestParseValidGenesis(t *testing.T) {
	s, err := ParseVerifiedRunCheckpointSubmission(decode(t, `{"playerId":" player_123 ","clientRunId":"run-1",
	"genesis":{"seed":42,"difficulty":"easy","rulesetId":"leaderboard-ruleset-v1"},"parentHeadHash":null,
	"actions":[{"type":"BuildDatacenter","specId":"garage","dcId":"dc-1","regionId":"region-1"},{"type":"Tick"}]}`))
	if err != nil {
		t.Fatal(err)
	}
	if s.PlayerID != "player_123" || s.ClientRunID != "run-1" || s.Genesis.Seed != 42 || s.ParentHeadHash != nil || len(s.Actions) != 2 {
		t.Fatalf("%+v", s)
	}
	b, _ := json.Marshal(s.Actions[0])
	if string(b) != `{"dcId":"dc-1","regionId":"region-1","specId":"garage","type":"BuildDatacenter"}` {
		t.Fatal(string(b))
	}
}

func TestValidationMessages(t *testing.T) {
	hash := strings.Repeat("a", 64)
	base := func(extra string) string {
		return `{"playerId":"p","clientRunId":"r","parentHeadHash":null,"actions":[]` + extra + `}`
	}
	cases := []struct{ body, want string }{
		{`[]`, "Verified leaderboard submission must be a JSON object."},
		{`null`, "Verified leaderboard submission must be a JSON object."},
		{`"x"`, "Verified leaderboard submission must be a JSON object."},
		{base(`,"metrics":{"money":1},"gameMonth":1`), "Unsupported field(s): metrics, gameMonth"},
		{base(`,"gameMonth":1`), "Unsupported field(s): gameMonth"},
		{`{"gameMonth":1,"metrics":1}`, "Unsupported field(s): gameMonth, metrics"},
		{`{"2":1,"b":1,"1":1,"a":1}`, "Unsupported field(s): 1, 2, b, a"},
		{`{"clientRunId":"r","parentHeadHash":null,"actions":[]}`, "playerId must be a string."},
		{`{"playerId":"  ","clientRunId":"r","parentHeadHash":null,"actions":[]}`, "playerId is required."},
		{`{"playerId":"p","clientRunId":"a b","parentHeadHash":null,"actions":[]}`, "clientRunId may only contain letters, numbers, periods, underscores, colons, and hyphens."},
		{`{"playerId":"p","clientRunId":5,"parentHeadHash":null,"actions":[]}`, "clientRunId must be a string."},
		{`{"playerId":"p","clientRunId":"` + strings.Repeat("a", 129) + `","parentHeadHash":null,"actions":[]}`, "clientRunId may only contain letters, numbers, periods, underscores, colons, and hyphens."},
		{`{"playerId":"p","clientRunId":"r","actions":[]}`, "parentHeadHash must be a string."},
		{`{"playerId":"p","clientRunId":"r","parentHeadHash":"abc","actions":[]}`, "parentHeadHash must be a 64-character lowercase hex SHA-256 digest or null."},
		{`{"playerId":"p","clientRunId":"r","parentHeadHash":"` + strings.ToUpper(hash) + `","actions":[]}`, "parentHeadHash must be a 64-character lowercase hex SHA-256 digest or null."},
		{`{"playerId":"p","clientRunId":"r","parentHeadHash":null}`, "actions must be an array."},
		{`{"playerId":"p","clientRunId":"r","parentHeadHash":null,"actions":{}}`, "actions must be an array."},
		{base(`,"genesis":null`), "genesis must be an object when provided."},
		{base(`,"genesis":[]`), "genesis must be an object when provided."},
		{base(`,"genesis":{"seed":1,"difficulty":"easy","rulesetId":"x","extra":1}`), "Unsupported field(s): extra"},
		{base(`,"genesis":{"seed":1.5,"difficulty":"easy","rulesetId":"x"}`), "genesis.seed must be a non-negative 32-bit safe integer."},
		{base(`,"genesis":{"seed":-1,"difficulty":"easy","rulesetId":"x"}`), "genesis.seed must be a non-negative 32-bit safe integer."},
		{base(`,"genesis":{"seed":4294967296,"difficulty":"easy","rulesetId":"x"}`), "genesis.seed must be a non-negative 32-bit safe integer."},
		{base(`,"genesis":{"seed":1e999,"difficulty":"easy","rulesetId":"x"}`), "genesis.seed must be a non-negative 32-bit safe integer."},
		{base(`,"genesis":{"seed":"1","difficulty":"easy","rulesetId":"x"}`), "genesis.seed must be a non-negative 32-bit safe integer."},
		{base(`,"genesis":{"difficulty":"easy","rulesetId":"x"}`), "genesis.seed must be a non-negative 32-bit safe integer."},
		{base(`,"genesis":{"seed":1,"difficulty":"medium","rulesetId":"x"}`), "genesis.difficulty must be one of: easy, hard."},
		{base(`,"genesis":{"seed":1,"difficulty":"easy"}`), "genesis.rulesetId must be a string."},
		{base(`,"genesis":{"seed":1,"difficulty":"easy","rulesetId":"a b"}`), "genesis.rulesetId contains unsupported characters."},
		{`{"playerId":"p","clientRunId":"r","parentHeadHash":null,"actions":[5]}`, "actions[0] must be an object."},
		{`{"playerId":"p","clientRunId":"r","parentHeadHash":null,"actions":[[]]}`, "actions[0] must be an object."},
		{`{"playerId":"p","clientRunId":"r","parentHeadHash":null,"actions":[{}]}`, "actions[0].type must be a string."},
		{`{"playerId":"p","clientRunId":"r","parentHeadHash":null,"actions":[{"type":" "}]}`, "actions[0].type is required."},
		{`{"playerId":"p","clientRunId":"r","parentHeadHash":null,"actions":[{"type":"Tick"},{"type":" SetPaused ","paused":true}]}`, "actions[1].type is unsupported: SetPaused"},
		{`{"playerId":"p","clientRunId":"r","parentHeadHash":null,"actions":[{"type":"Tick","bogus":true,"a":1}]}`, "Unsupported field(s): bogus, a"},
		{`{"playerId":"p","clientRunId":"r","parentHeadHash":null,"actions":[{"type":"PlaceRack","dcId":"d","specId":"s","row":1.5,"position":0,"placementId":"p"}]}`, "actions[0].row must be a safe integer between 0 and 10000."},
		{`{"playerId":"p","clientRunId":"r","parentHeadHash":null,"actions":[{"type":"PlaceRack","dcId":"d","specId":"s","row":0,"position":10001,"placementId":"p"}]}`, "actions[0].position must be a safe integer between 0 and 10000."},
		{`{"playerId":"p","clientRunId":"r","parentHeadHash":null,"actions":[{"type":"SetMaintenanceStaff","dcId":"d","maintenanceStaff":-1}]}`, "actions[0].maintenanceStaff must be a safe integer between 0 and 10000."},
		{`{"playerId":"p","clientRunId":"r","parentHeadHash":null,"actions":[{"type":"CancelContract"}]}`, "actions[0].contractId must be a string."},
		{`{"playerId":"p","clientRunId":"r","parentHeadHash":null,"actions":[{"type":"CancelContract","contractId":"` + strings.Repeat("c", 129) + `"}]}`, "actions[0].contractId must be at most 128 characters."},
	}
	for _, c := range cases {
		if got := validationMsg(t, c.body); got != c.want {
			t.Errorf("%s\n got %q\nwant %q", c.body, got, c.want)
		}
	}
}

func TestSeedBoundariesAndNegativeZero(t *testing.T) {
	for _, seed := range []string{"0", "-0", "4294967295", "1e3", "5.0"} {
		_, err := ParseVerifiedRunCheckpointSubmission(decode(t, `{"playerId":"p","clientRunId":"r","parentHeadHash":null,"actions":[],"genesis":{"seed":`+seed+`,"difficulty":"hard","rulesetId":"x"}}`))
		if err != nil {
			t.Errorf("seed %s: %v", seed, err)
		}
	}
}

func TestAllActionTypesAccepted(t *testing.T) {
	rt, err := jsbridge.Default()
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(rt.ActionTypes(), VerificationActionTypes) {
		t.Fatalf("action types drifted: %v vs %v", rt.ActionTypes(), VerificationActionTypes)
	}
	if !reflect.DeepEqual(rt.MetricKeys(), LeaderboardMetricKeys) {
		t.Fatalf("metric keys drifted: %v", rt.MetricKeys())
	}
	for _, typ := range VerificationActionTypes {
		if _, ok := actionSchemas[typ]; !ok {
			t.Errorf("no schema for %s", typ)
		}
	}
}

func TestDecodeJSONErrors(t *testing.T) {
	for _, s := range []string{``, `{`, `{"a":1} x`, `[1,]`, `{"a":1}{}`} {
		if _, err := DecodeJSON([]byte(s)); err == nil {
			t.Errorf("%q should fail", s)
		}
	}
}

func TestParseLeaderboardQuery(t *testing.T) {
	q, err := ParseLeaderboardQuery(url.Values{})
	if err != nil || q != (LeaderboardQuery{"money", "all-time", 10, "verified"}) {
		t.Fatalf("%+v %v", q, err)
	}
	q, err = ParseLeaderboardQuery(url.Values{"metric": {"totalCapacity"}, "limit": {" 0x10 "}, "visibility": {"all"}})
	if err != nil || q.Limit != 16 || q.Metric != "totalCapacity" || q.Visibility != "all" {
		t.Fatalf("%+v %v", q, err)
	}
	if q, err = ParseLeaderboardQuery(url.Values{"limit": {"1e1"}}); err != nil || q.Limit != 10 {
		t.Fatalf("%+v %v", q, err)
	}
	bad := []struct {
		v    url.Values
		want string
	}{
		{url.Values{"metric": {"nope"}}, "Unsupported leaderboard metric: nope"},
		{url.Values{"metric": {""}}, "Unsupported leaderboard metric: "},
		{url.Values{"period": {"weekly"}}, "Unsupported leaderboard period: weekly"},
		{url.Values{"limit": {"0"}}, "limit must be an integer between 1 and 100."},
		{url.Values{"limit": {"101"}}, "limit must be an integer between 1 and 100."},
		{url.Values{"limit": {"1.5"}}, "limit must be an integer between 1 and 100."},
		{url.Values{"limit": {"abc"}}, "limit must be an integer between 1 and 100."},
		{url.Values{"limit": {"NaN"}}, "limit must be an integer between 1 and 100."},
		{url.Values{"limit": {"Infinity"}}, "limit must be an integer between 1 and 100."},
		{url.Values{"limit": {"1_0"}}, "limit must be an integer between 1 and 100."},
		{url.Values{"limit": {""}}, "limit must be an integer between 1 and 100."},
		{url.Values{"visibility": {"x"}}, "Unsupported leaderboard visibility: x"},
	}
	for _, c := range bad {
		_, err := ParseLeaderboardQuery(c.v)
		var qe *QueryValidationError
		if !errors.As(err, &qe) || qe.Message != c.want || qe.Code != "INVALID_LEADERBOARD_QUERY" {
			t.Errorf("%v: %v", c.v, err)
		}
	}
}

// ---- end-to-end against Bun-generated golden ----

type flowGolden struct {
	Username string
	Actions  []map[string]any
	First    VerifiedCheckpointResponse
	Second   VerifiedCheckpointResponse
	BoardVal []int64 `json:"boardValues"`
	Rejected string
}

var testCfg = VerificationConfig{ProtocolVersion: "verified-run-v1", RulesetID: "leaderboard-ruleset-v1", MaxActionCount: 2000, MaxTickDelta: 15}

func loadFlow(t *testing.T) flowGolden {
	t.Helper()
	b, err := os.ReadFile("../../testdata/leaderboard-flow-golden.json")
	if err != nil {
		t.Fatal(err)
	}
	var g flowGolden
	if err := json.Unmarshal(b, &g); err != nil {
		t.Fatal(err)
	}
	return g
}

func submit(t *testing.T, rt *jsbridge.Runtime, pr players.PlayersRepository, lr LeaderboardRepository, body any) (*VerifiedCheckpointResponse, error) {
	t.Helper()
	raw, _ := json.Marshal(body)
	return SubmitLeaderboardRun(context.Background(), rt, pr, lr, decode(t, string(raw)), testCfg)
}

func status(t *testing.T, err error) *StatusError {
	t.Helper()
	var se *StatusError
	if !errors.As(err, &se) {
		t.Fatalf("expected StatusError, got %v", err)
	}
	return se
}

func TestVerifiedFlowMatchesBunGolden(t *testing.T) {
	g := loadFlow(t)
	rt, _ := jsbridge.Default()
	ctx := context.Background()
	pr := players.NewInMemoryPlayersRepository()
	lr := NewInMemoryLeaderboardRepository(nil)
	reg, err := players.RegisterPlayerUsername(ctx, pr, g.Username)
	if err != nil {
		t.Fatal(err)
	}
	genesis := map[string]any{"seed": 42, "difficulty": "easy", "rulesetId": "leaderboard-ruleset-v1"}

	first, err := submit(t, rt, pr, lr, map[string]any{"playerId": reg.PlayerID, "clientRunId": "run-001", "genesis": genesis, "parentHeadHash": nil, "actions": []any{}})
	if err != nil {
		t.Fatal(err)
	}
	if !first.Created || first.RootHash != g.First.RootHash || first.HeadHash != g.First.HeadHash || first.Metrics != g.First.Metrics || first.GameMonth != g.First.GameMonth {
		t.Fatalf("first mismatch\n got %+v\nwant %+v", first, g.First)
	}

	// genesis-only run earns nothing: excluded from the board
	res, err := QueryLeaderboardEntries(ctx, pr, lr, url.Values{})
	if err != nil || len(res.Entries) != 0 {
		t.Fatalf("%+v %v", res, err)
	}

	// idempotent resubmit of the genesis checkpoint returns created=false
	again, err := submit(t, rt, pr, lr, map[string]any{"playerId": reg.PlayerID, "clientRunId": "run-001", "genesis": genesis, "parentHeadHash": nil, "actions": []any{}})
	if err != nil || again.Created || again.HeadHash != first.HeadHash {
		t.Fatalf("%+v %v", again, err)
	}

	earn := map[string]any{"playerId": reg.PlayerID, "clientRunId": "run-001", "parentHeadHash": first.HeadHash, "actions": g.Actions}
	second, err := submit(t, rt, pr, lr, earn)
	if err != nil {
		t.Fatal(err)
	}
	if second.Created != g.Second.Created || second.RootHash != g.Second.RootHash || second.HeadHash != g.Second.HeadHash ||
		second.Metrics != g.Second.Metrics || second.GameMonth != g.Second.GameMonth {
		t.Fatalf("second mismatch\n got %+v\nwant %+v", second, g.Second)
	}

	// replaying the same request is idempotent
	dup, err := submit(t, rt, pr, lr, earn)
	if err != nil || dup.Created || dup.HeadHash != second.HeadHash || dup.Metrics != second.Metrics {
		t.Fatalf("%+v %v", dup, err)
	}

	board, err := QueryLeaderboardEntries(ctx, pr, lr, url.Values{"metric": {"totalCapacity"}})
	if err != nil || len(board.Entries) != 1 || board.Entries[0].Value != g.BoardVal[0] || board.Entries[0].Username != g.Username || board.Entries[0].Rank != 1 {
		t.Fatalf("%+v %v", board, err)
	}
	j, _ := json.Marshal(board.Entries[0])
	if !strings.Contains(string(j), `"submittedAt":"20`) || !strings.HasPrefix(string(j), `{"rank":1,"playerId":`) {
		t.Fatal(string(j))
	}

	// stale parent
	_, err = submit(t, rt, pr, lr, map[string]any{"playerId": reg.PlayerID, "clientRunId": "run-001", "parentHeadHash": first.HeadHash, "actions": []any{map[string]any{"type": "Tick"}}})
	if se := status(t, err); se.Status != 409 || se.Code != "STALE_RUN_HEAD" ||
		se.Message != "Run run-001 expected parent "+second.HeadHash+", received "+first.HeadHash+"." {
		t.Fatalf("%+v", se)
	}
	// genesis after head accepted
	_, err = submit(t, rt, pr, lr, map[string]any{"playerId": reg.PlayerID, "clientRunId": "run-001", "genesis": genesis, "parentHeadHash": second.HeadHash, "actions": []any{}})
	if se := status(t, err); se.Status != 400 || se.Message != "genesis must be omitted after the server has accepted a verified run head." {
		t.Fatalf("%+v", se)
	}
	// replay rejection message equals JS error message (as Bun)
	_, err = submit(t, rt, pr, lr, map[string]any{"playerId": reg.PlayerID, "clientRunId": "run-001", "parentHeadHash": second.HeadHash,
		"actions": []any{map[string]any{"type": "PlaceRack", "dcId": "nope", "specId": "x", "row": 0, "position": 0, "placementId": "p"}}})
	if se := status(t, err); se.Status != 409 || se.Code+"|"+se.Message == "" || se.Code+": "+se.Message != "RUN_REPLAY_REJECTED: Unknown datacenter: nope" {
		t.Fatalf("%+v (bun: %s)", se, g.Rejected)
	}
}

func TestSubmissionErrors(t *testing.T) {
	rt, _ := jsbridge.Default()
	ctx := context.Background()
	pr := players.NewInMemoryPlayersRepository()
	lr := NewInMemoryLeaderboardRepository(nil)
	reg, _ := players.RegisterPlayerUsername(ctx, pr, "Tester")
	genesis := map[string]any{"seed": 1, "difficulty": "easy", "rulesetId": "leaderboard-ruleset-v1"}
	hash := strings.Repeat("b", 64)

	_, err := submit(t, rt, pr, lr, map[string]any{"playerId": "ghost", "clientRunId": "r", "parentHeadHash": nil, "actions": []any{}})
	if se := status(t, err); se.Status != 404 || se.Code != "PLAYER_NOT_FOUND" || se.Message != "Unknown player id: ghost" {
		t.Fatalf("%+v", se)
	}
	_, err = submit(t, rt, pr, lr, map[string]any{"playerId": reg.PlayerID, "clientRunId": "r", "parentHeadHash": nil, "actions": []any{}})
	if se := status(t, err); se.Status != 404 || se.Code != "UNKNOWN_RUN_HEAD" || se.Message != "Run r has no accepted verified head yet; genesis is required." {
		t.Fatalf("%+v", se)
	}
	_, err = submit(t, rt, pr, lr, map[string]any{"playerId": reg.PlayerID, "clientRunId": "r", "genesis": genesis, "parentHeadHash": hash, "actions": []any{}})
	if se := status(t, err); se.Status != 404 || se.Message != "Run r cannot continue from unknown parent "+hash+"." {
		t.Fatalf("%+v", se)
	}
	bad := map[string]any{"seed": 1, "difficulty": "easy", "rulesetId": "other"}
	_, err = submit(t, rt, pr, lr, map[string]any{"playerId": reg.PlayerID, "clientRunId": "r", "genesis": bad, "parentHeadHash": nil, "actions": []any{}})
	if se := status(t, err); se.Status != 409 || se.Code != "RUN_RULESET_UNSUPPORTED" || se.Message != "Unsupported verified-run ruleset: other." {
		t.Fatalf("%+v", se)
	}
	// tick gap: 16 Ticks > 15
	ticks := make([]any, 16)
	for i := range ticks {
		ticks[i] = map[string]any{"type": "Tick"}
	}
	_, err = submit(t, rt, pr, lr, map[string]any{"playerId": reg.PlayerID, "clientRunId": "r", "genesis": genesis, "parentHeadHash": nil, "actions": ticks})
	if se := status(t, err); se.Status != 409 || se.Code != "RUN_TICK_GAP_EXCEEDED" ||
		!strings.HasPrefix(se.Message, "Verified replay advanced 16 completed month(s), exceeding the limit of 15.") {
		t.Fatalf("%+v", se)
	}
	// action cap
	small := testCfg
	small.MaxActionCount = 1
	raw := decode(t, `{"playerId":"`+reg.PlayerID+`","clientRunId":"r","genesis":{"seed":1,"difficulty":"easy","rulesetId":"leaderboard-ruleset-v1"},"parentHeadHash":null,"actions":[{"type":"Tick"},{"type":"Tick"}]}`)
	_, err = SubmitLeaderboardRun(ctx, rt, pr, lr, raw, small)
	if se := status(t, err); se.Status != 400 || se.Message != "actions may contain at most 1 entries." {
		t.Fatalf("%+v", se)
	}
	// nothing was committed by the failures
	if h, _ := lr.FindRunHead(ctx, reg.PlayerID, "r"); h != nil {
		t.Fatal("head committed by failed submissions")
	}
}

func TestInMemoryRepositoryCommitAndList(t *testing.T) {
	ctx := context.Background()
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	clock := func() time.Time { now = now.Add(time.Second); return now }
	lr := NewInMemoryLeaderboardRepository(clock)
	mk := func(player, run string, parent *string, head string, rev int64) CommitVerifiedRunInput {
		return CommitVerifiedRunInput{
			ExpectedParentHeadHash: parent,
			Run: LeaderboardRunRecord{PlayerID: player, ClientRunID: run, VerificationStatus: VerificationVerified,
				Metrics: LeaderboardMetrics{Money: rev, CumulativeRevenue: rev}, GameMonth: 1},
			Head: VerifiedLeaderboardRunHeadRecord{PlayerID: player, ClientRunID: run, HeadHash: head},
		}
	}
	p := "x"
	if _, err := lr.CommitVerifiedRun(ctx, mk("a", "r1", &p, "h1", 5)); !errors.As(err, new(*StaleRunHeadError)) {
		t.Fatalf("%v", err)
	}
	r1, err := lr.CommitVerifiedRun(ctx, mk("a", "r1", nil, "h1", 5))
	if err != nil || !r1.Created || r1.Head.Revision != 1 || r1.Run.RunID[:4] != "run_" || len(r1.Run.RunID) != 36 {
		t.Fatalf("%+v %v", r1, err)
	}
	_, err = lr.CommitVerifiedRun(ctx, mk("a", "r1", nil, "h2", 5))
	var se *StaleRunHeadError
	if !errors.As(err, &se) || se.Message != "Run r1 expected parent null, current head is h1." {
		t.Fatalf("%v", err)
	}
	h1 := "h1"
	r2, err := lr.CommitVerifiedRun(ctx, mk("a", "r1", &h1, "h2", 50))
	if err != nil || r2.Created || r2.Head.Revision != 2 || r2.Run.RunID != r1.Run.RunID ||
		!r2.Run.SubmittedAt.Equal(r1.Run.SubmittedAt) || !r2.Head.CreatedAt.Equal(r1.Head.CreatedAt) || !r2.Run.UpdatedAt.After(r1.Run.UpdatedAt) {
		t.Fatalf("%+v %v", r2, err)
	}
	lr.CommitVerifiedRun(ctx, mk("b", "r1", nil, "hb", 70))
	lr.CommitVerifiedRun(ctx, mk("c", "r1", nil, "hc", 0)) // zero revenue excluded
	runs, _ := lr.ListRuns(ctx, LeaderboardQuery{Metric: "money", Period: "all-time", Limit: 10, Visibility: "verified"})
	if len(runs) != 2 || runs[0].PlayerID != "b" || runs[1].PlayerID != "a" {
		t.Fatalf("%+v", runs)
	}
	runs, _ = lr.ListRuns(ctx, LeaderboardQuery{Metric: "money", Period: "all-time", Limit: 1, Visibility: "all"})
	if len(runs) != 1 {
		t.Fatal(len(runs))
	}
}

func TestConcurrentSubmissionsSameRun(t *testing.T) {
	rt, _ := jsbridge.Default()
	ctx := context.Background()
	pr := players.NewInMemoryPlayersRepository()
	lr := NewInMemoryLeaderboardRepository(nil)
	reg, _ := players.RegisterPlayerUsername(ctx, pr, "Racer")
	genesis := map[string]any{"seed": 7, "difficulty": "easy", "rulesetId": "leaderboard-ruleset-v1"}
	var wg sync.WaitGroup
	results := make([]*VerifiedCheckpointResponse, 6)
	errs := make([]error, 6)
	for i := range results {
		wg.Add(1)
		go func() {
			defer wg.Done()
			raw, _ := json.Marshal(map[string]any{"playerId": reg.PlayerID, "clientRunId": "race", "genesis": genesis, "parentHeadHash": nil, "actions": []any{}})
			v, _ := DecodeJSON(raw)
			results[i], errs[i] = SubmitLeaderboardRun(ctx, rt, pr, lr, v, testCfg)
		}()
	}
	wg.Wait()
	created := 0
	for i := range results {
		if errs[i] != nil {
			t.Fatal(errs[i])
		}
		if results[i].Created {
			created++
		}
	}
	if created < 1 {
		t.Fatal("no creator")
	}
}
