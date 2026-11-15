package leaderboard

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"
)

func buildRunKey(playerID, clientRunID string) string { return playerID + ":" + clientRunID }

// InMemoryLeaderboardRepository is a goroutine-safe in-memory LeaderboardRepository.
// Tie-breaking on clientRunId/runId uses byte order (TS uses localeCompare); this only
// matters for runs with identical metric and submittedAt millisecond.
type InMemoryLeaderboardRepository struct {
	mu    sync.Mutex
	runs  map[string]LeaderboardRunRecord
	heads map[string]VerifiedLeaderboardRunHeadRecord
	clock func() time.Time
}

// NewInMemoryLeaderboardRepository creates the repo; a nil clock uses time.Now truncated to ms.
func NewInMemoryLeaderboardRepository(clock func() time.Time) *InMemoryLeaderboardRepository {
	if clock == nil {
		clock = func() time.Time { return time.Now().Truncate(time.Millisecond) }
	}
	return &InMemoryLeaderboardRepository{
		runs: map[string]LeaderboardRunRecord{}, heads: map[string]VerifiedLeaderboardRunHeadRecord{}, clock: clock,
	}
}

func (r *InMemoryLeaderboardRepository) FindRunHead(_ context.Context, playerID, clientRunID string) (*VerifiedLeaderboardRunHeadRecord, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if h, ok := r.heads[buildRunKey(playerID, clientRunID)]; ok {
		return &h, nil
	}
	return nil, nil
}

func (r *InMemoryLeaderboardRepository) CommitVerifiedRun(_ context.Context, input CommitVerifiedRunInput) (*VerifiedRunCommitResult, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	key := buildRunKey(input.Run.PlayerID, input.Run.ClientRunID)
	existing, hasHead := r.heads[key]

	if !hasHead && input.ExpectedParentHeadHash != nil {
		return nil, NewStaleRunHeadError(fmt.Sprintf(
			"Run %s does not have a verified head for parent %s.", input.Run.ClientRunID, *input.ExpectedParentHeadHash))
	}
	if hasHead && (input.ExpectedParentHeadHash == nil || existing.HeadHash != *input.ExpectedParentHeadHash) {
		return nil, NewStaleRunHeadError(fmt.Sprintf(
			"Run %s expected parent %s, current head is %s.", input.Run.ClientRunID, jsString(input.ExpectedParentHeadHash), existing.HeadHash))
	}

	now := r.clock()
	existingRun, hasRun := r.runs[key]
	runID, submittedAt := GenerateLeaderboardRunID(), now
	if hasRun {
		runID, submittedAt = existingRun.RunID, existingRun.SubmittedAt
	}
	in := input.Run
	run := CreateLeaderboardRunRecord(CreateLeaderboardRunInput{
		RunID: runID, PlayerID: in.PlayerID, ClientRunID: in.ClientRunID, VerificationStatus: in.VerificationStatus,
		Metrics: in.Metrics, GameMonth: in.GameMonth, SubmittedAt: submittedAt, UpdatedAt: now,
	})
	head := input.Head
	if hasHead {
		head.Revision, head.CreatedAt = existing.Revision+1, existing.CreatedAt
	} else {
		head.Revision, head.CreatedAt = 1, now
	}
	head.UpdatedAt = now
	r.runs[key] = run
	r.heads[key] = head
	return &VerifiedRunCommitResult{Created: !hasHead, Run: run, Head: head}, nil
}

func (r *InMemoryLeaderboardRepository) ListRuns(_ context.Context, query LeaderboardQuery) ([]LeaderboardRunRecord, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]LeaderboardRunRecord, 0, len(r.runs))
	for _, run := range r.runs {
		if run.Metrics.CumulativeRevenue <= 0 {
			continue
		}
		if query.Visibility != "all" {
			if run.VerificationStatus != VerificationVerified {
				continue
			}
			if _, ok := r.heads[buildRunKey(run.PlayerID, run.ClientRunID)]; !ok {
				continue
			}
		}
		out = append(out, run)
	}
	sort.SliceStable(out, func(i, j int) bool { return compareRuns(out[i], out[j], query.Metric) < 0 })
	if len(out) > query.Limit {
		out = out[:query.Limit]
	}
	return out, nil
}

func compareRuns(l, r LeaderboardRunRecord, metric string) int {
	lv, rv := GetMetricValue(l.Metrics, metric), GetMetricValue(r.Metrics, metric)
	if rv != lv {
		if rv > lv {
			return 1
		}
		return -1
	}
	if !l.SubmittedAt.Equal(r.SubmittedAt) {
		if l.SubmittedAt.Before(r.SubmittedAt) {
			return -1
		}
		return 1
	}
	if c := strings.Compare(l.ClientRunID, r.ClientRunID); c != 0 {
		return c
	}
	return strings.Compare(l.RunID, r.RunID)
}

// jsString renders a nullable string like JS template interpolation ("null").
func jsString(s *string) string {
	if s == nil {
		return "null"
	}
	return *s
}
