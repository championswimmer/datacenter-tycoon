package pgrepo_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/championswimmer/datacenter-tycoon/server-go/internal/db/dbtest"
	"github.com/championswimmer/datacenter-tycoon/server-go/internal/leaderboard"
	"github.com/championswimmer/datacenter-tycoon/server-go/internal/leaderboard/pgrepo"
	"github.com/championswimmer/datacenter-tycoon/server-go/internal/players"
	playerspg "github.com/championswimmer/datacenter-tycoon/server-go/internal/players/pgrepo"
	"github.com/jackc/pgx/v5/pgxpool"
)

var now = time.Date(2026, 7, 26, 12, 0, 0, 0, time.UTC)

func strp(s string) *string { return &s }

func input(playerID, clientRunID, name, headHash string, parent *string, money, revenue int64) leaderboard.CommitVerifiedRunInput {
	state := fmt.Sprintf(`{"player":{"name":%q},"marker":"%s"}`, name, headHash)
	return leaderboard.CommitVerifiedRunInput{
		ExpectedParentHeadHash: parent,
		Run: leaderboard.CreateLeaderboardRunRecord(leaderboard.CreateLeaderboardRunInput{
			RunID: "placeholder", PlayerID: playerID, ClientRunID: clientRunID,
			VerificationStatus: leaderboard.VerificationVerified,
			Metrics: leaderboard.LeaderboardMetrics{Money: money, CumulativeRevenue: revenue, TotalServers: 1,
				ComputeCapacity: 100, MemoryCapacity: 200, StorageCapacity: 300},
			GameMonth: 3, UpdatedAt: now,
		}),
		Head: leaderboard.VerifiedLeaderboardRunHeadRecord{
			PlayerID: playerID, ClientRunID: clientRunID, ProtocolVersion: "verified-run-v1",
			RulesetID:         "leaderboard-ruleset-v1",
			GenesisDescriptor: json.RawMessage(fmt.Sprintf(`{"seed":42,"difficulty":"easy","gameId":%q,"playerName":%q}`, clientRunID, name)),
			RootHash:          strings.Repeat("a", 64), HeadHash: headHash, StateHash: strings.Repeat("c", 64),
			PreviousHeadHash: parent, LastRequestHash: strings.Repeat("d", 64),
			AuthoritativeState: json.RawMessage(state), GameMonth: 3,
		},
	}
}

func setup(t *testing.T) (*pgxpool.Pool, *pgrepo.Repository, *playerspg.Repository) {
	pool := dbtest.NewMigratedPool(t)
	return pool, pgrepo.New(pool), playerspg.New(pool)
}

func mkPlayer(t *testing.T, pr *playerspg.Repository, name string) string {
	p, err := pr.CreatePlayer(context.Background(), players.RegisterPlayerInput{Username: name})
	if err != nil {
		t.Fatal(err)
	}
	return p.PlayerID
}

func h(c string) string { return strings.Repeat(c, 64) }

func TestCommitVerifiedHeadsAndListOnlyVerifiedRuns(t *testing.T) {
	ctx := context.Background()
	pool, repo, pr := setup(t)
	alpha, beta, gamma := mkPlayer(t, pr, "Alpha Cloud"), mkPlayer(t, pr, "Beta Cloud"), mkPlayer(t, pr, "Gamma Cloud")

	committed, err := repo.CommitVerifiedRun(ctx, input(alpha, "run-alpha", "Alpha Cloud", h("b"), nil, 10, 20))
	if err != nil {
		t.Fatal(err)
	}
	if !committed.Created || committed.Run.VerificationStatus != "verified" || committed.Head.Revision != 1 {
		t.Fatalf("committed: %+v", committed)
	}
	if !strings.HasPrefix(committed.Run.RunID, "run_") {
		t.Fatalf("run id %q", committed.Run.RunID)
	}
	head, err := repo.FindRunHead(ctx, alpha, "run-alpha")
	if err != nil || head == nil || head.HeadHash != h("b") {
		t.Fatalf("head: %+v %v", head, err)
	}
	if string(head.GenesisDescriptor) != `{"seed":42,"difficulty":"easy","gameId":"run-alpha","playerName":"Alpha Cloud"}` {
		t.Fatalf("descriptor %s", head.GenesisDescriptor)
	}
	if string(head.AuthoritativeState) != fmt.Sprintf(`{"player":{"name":"Alpha Cloud"},"marker":"%s"}`, h("b")) {
		t.Fatalf("state %s", head.AuthoritativeState)
	}
	if head.PreviousHeadHash != nil {
		t.Fatal("previous head should be nil")
	}
	if missing, err := repo.FindRunHead(ctx, alpha, "nope"); missing != nil || err != nil {
		t.Fatalf("missing: %v %v", missing, err)
	}

	// Legacy unverified run for beta (no head).
	if _, err := pool.Exec(ctx, `INSERT INTO leaderboard_runs (id, player_id, client_run_id, verification_status, money,
		cumulative_revenue, total_servers, compute_capacity, memory_capacity, storage_capacity, gpu_capacity, game_month)
		VALUES ('legacy-run', $1, 'run-beta', 'unverified', 99, 99, 9, 9, 9, 9, 9, 9)`, beta); err != nil {
		t.Fatal(err)
	}
	// Zero-revenue verified run for gamma.
	i := input(gamma, "run-gamma", "Gamma Cloud", h("e"), nil, 999, 0)
	if _, err := repo.CommitVerifiedRun(ctx, i); err != nil {
		t.Fatal(err)
	}

	verified, err := repo.ListRuns(ctx, leaderboard.LeaderboardQuery{Metric: "money", Period: "all-time", Limit: 5, Visibility: "verified"})
	if err != nil || len(verified) != 1 || verified[0].PlayerID != alpha || verified[0].VerificationStatus != "verified" {
		t.Fatalf("verified: %+v %v", verified, err)
	}
	all, err := repo.ListRuns(ctx, leaderboard.LeaderboardQuery{Metric: "money", Period: "all-time", Limit: 5, Visibility: "all"})
	if err != nil || len(all) != 2 || all[0].PlayerID != beta || all[1].PlayerID != alpha {
		t.Fatalf("all: %+v %v", all, err)
	}
}

func TestCommitStaleHeadAndRevisions(t *testing.T) {
	ctx := context.Background()
	_, repo, pr := setup(t)
	p := mkPlayer(t, pr, "Alpha Cloud")

	var stale *leaderboard.StaleRunHeadError
	// parent given but no head yet
	if _, err := repo.CommitVerifiedRun(ctx, input(p, "r1", "Alpha Cloud", h("b"), strp(h("z")), 1, 1)); !errors.As(err, &stale) {
		t.Fatalf("expected stale, got %v", err)
	} else if stale.Message != "Run r1 does not have a verified head for parent "+h("z")+"." {
		t.Fatal(stale.Message)
	}
	first, err := repo.CommitVerifiedRun(ctx, input(p, "r1", "Alpha Cloud", h("b"), nil, 1, 1))
	if err != nil {
		t.Fatal(err)
	}
	// nil parent when head exists
	if _, err := repo.CommitVerifiedRun(ctx, input(p, "r1", "Alpha Cloud", h("c"), nil, 1, 1)); !errors.As(err, &stale) {
		t.Fatalf("expected stale, got %v", err)
	} else if stale.Message != "Run r1 expected parent null, current head is "+h("b")+"." {
		t.Fatal(stale.Message)
	}
	// wrong parent
	if _, err := repo.CommitVerifiedRun(ctx, input(p, "r1", "Alpha Cloud", h("c"), strp(h("q")), 1, 1)); !errors.As(err, &stale) {
		t.Fatalf("expected stale, got %v", err)
	}
	second, err := repo.CommitVerifiedRun(ctx, input(p, "r1", "Alpha Cloud", h("c"), strp(h("b")), 50, 60))
	if err != nil {
		t.Fatal(err)
	}
	if second.Created || second.Head.Revision != 2 || second.Run.RunID != first.Run.RunID {
		t.Fatalf("second: %+v", second)
	}
	if !second.Run.SubmittedAt.Equal(first.Run.SubmittedAt) || !second.Head.CreatedAt.Equal(first.Head.CreatedAt) {
		t.Fatal("submitted_at/created_at must be preserved")
	}
	if second.Run.Metrics.Money != 50 || second.Head.PreviousHeadHash == nil || *second.Head.PreviousHeadHash != h("b") {
		t.Fatalf("second: %+v", second)
	}
	// failed commit must not have altered state
	head, _ := repo.FindRunHead(ctx, p, "r1")
	if head.HeadHash != h("c") || head.Revision != 2 {
		t.Fatalf("head: %+v", head)
	}
}

func TestConcurrentCommitsOnSameHeadOnlyOneWins(t *testing.T) {
	ctx := context.Background()
	_, repo, pr := setup(t)
	p := mkPlayer(t, pr, "Alpha Cloud")
	if _, err := repo.CommitVerifiedRun(ctx, input(p, "r1", "Alpha Cloud", h("b"), nil, 1, 1)); err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	var mu sync.Mutex
	wins, stales := 0, 0
	for i := 0; i < 6; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_, err := repo.CommitVerifiedRun(ctx, input(p, "r1", "Alpha Cloud", strings.Repeat(fmt.Sprintf("%x", i+1), 64), strp(h("b")), 2, 2))
			mu.Lock()
			defer mu.Unlock()
			var s *leaderboard.StaleRunHeadError
			switch {
			case err == nil:
				wins++
			case errors.As(err, &s):
				stales++
			default:
				t.Errorf("unexpected %v", err)
			}
		}(i)
	}
	wg.Wait()
	if wins != 1 || stales != 5 {
		t.Fatalf("wins=%d stales=%d", wins, stales)
	}
}

func TestListRunsOrderingAndTieBreaks(t *testing.T) {
	ctx := context.Background()
	pool, repo, pr := setup(t)
	var ids []string
	for i, n := range []string{"Aaa One", "Bbb Two", "Ccc Three", "Ddd Four"} {
		p := mkPlayer(t, pr, n)
		ids = append(ids, p)
		money := int64(100)
		if i == 3 {
			money = 500
		}
		if _, err := repo.CommitVerifiedRun(ctx, input(p, fmt.Sprintf("run-%d", 3-i), n, strings.Repeat(fmt.Sprintf("%x", i+1), 64), nil, money, 10)); err != nil {
			t.Fatal(err)
		}
	}
	// Force identical submitted_at on the first three to exercise client_run_id tie-break.
	if _, err := pool.Exec(ctx, `UPDATE leaderboard_runs SET submitted_at = $1`, now); err != nil {
		t.Fatal(err)
	}
	runs, err := repo.ListRuns(ctx, leaderboard.LeaderboardQuery{Metric: "money", Period: "all-time", Limit: 10, Visibility: "verified"})
	if err != nil || len(runs) != 4 {
		t.Fatalf("%v %v", runs, err)
	}
	var got []string
	for _, r := range runs {
		got = append(got, r.ClientRunID)
	}
	// money desc: run-0 (500); tie 100: client_run_id asc -> run-1, run-2, run-3
	if strings.Join(got, ",") != "run-0,run-1,run-2,run-3" {
		t.Fatalf("order %v", got)
	}
	// submitted_at ASC precedes client_run_id.
	if _, err := pool.Exec(ctx, `UPDATE leaderboard_runs SET submitted_at = $1 WHERE client_run_id = 'run-3'`, now.Add(-time.Hour)); err != nil {
		t.Fatal(err)
	}
	runs, _ = repo.ListRuns(ctx, leaderboard.LeaderboardQuery{Metric: "money", Period: "all-time", Limit: 2, Visibility: "verified"})
	if len(runs) != 2 || runs[0].ClientRunID != "run-0" || runs[1].ClientRunID != "run-3" {
		t.Fatalf("limit/order: %+v", runs)
	}
}

func TestListRunsAllMetricsIncludingTotalCapacity(t *testing.T) {
	ctx := context.Background()
	_, repo, pr := setup(t)
	p := mkPlayer(t, pr, "Alpha Cloud")
	if _, err := repo.CommitVerifiedRun(ctx, input(p, "r1", "Alpha Cloud", h("b"), nil, 1, 1)); err != nil {
		t.Fatal(err)
	}
	for _, m := range leaderboard.LeaderboardQueryMetrics {
		runs, err := repo.ListRuns(ctx, leaderboard.LeaderboardQuery{Metric: m, Period: "all-time", Limit: 3, Visibility: "verified"})
		if err != nil || len(runs) != 1 {
			t.Fatalf("%s: %v %v", m, runs, err)
		}
	}
	runs, _ := repo.ListRuns(ctx, leaderboard.LeaderboardQuery{Metric: "totalCapacity", Period: "all-time", Limit: 3, Visibility: "all"})
	if runs[0].Metrics.TotalCapacity() != 600 {
		t.Fatalf("%+v", runs[0])
	}
}
