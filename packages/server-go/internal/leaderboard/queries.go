package leaderboard

import (
	"context"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/championswimmer/datacenter-tycoon/server-go/internal/players"
)

// LeaderboardQueryMetrics mirrors LEADERBOARD_QUERY_METRICS.
var LeaderboardQueryMetrics = append(append([]string{}, LeaderboardMetricKeys...), "totalCapacity")

// LeaderboardQuery mirrors the TS interface. Visibility is "verified" or "all"; Period is "all-time".
type LeaderboardQuery struct {
	Metric     string
	Period     string
	Limit      int
	Visibility string
}

// LeaderboardEntry is one ranked row. MarshalJSON matches serializeLeaderboardEntry.
type LeaderboardEntry struct {
	Rank        int
	PlayerID    string
	Username    string
	Metric      string
	Value       int64
	SubmittedAt time.Time
	GameMonth   int
	Metrics     LeaderboardMetrics
}

func isQueryMetric(m string) bool {
	for _, k := range LeaderboardQueryMetrics {
		if k == m {
			return true
		}
	}
	return false
}

// ParseLeaderboardQuery mirrors parseLeaderboardQuery. searchParams.get returns
// the first value; absent -> default (an empty value present stays empty).
func ParseLeaderboardQuery(q url.Values) (LeaderboardQuery, error) {
	get := func(name, def string) string {
		if vs, ok := q[name]; ok && len(vs) > 0 {
			return vs[0]
		}
		return def
	}
	metric := get("metric", "money")
	period := get("period", "all-time")
	rawLimit := get("limit", "10")
	visibility := get("visibility", "verified")

	if !isQueryMetric(metric) {
		return LeaderboardQuery{}, NewQueryValidationError("Unsupported leaderboard metric: " + metric)
	}
	if period != "all-time" {
		return LeaderboardQuery{}, NewQueryValidationError("Unsupported leaderboard period: " + period)
	}
	limit, ok := jsNumberInteger(rawLimit)
	if !ok || limit < 1 || limit > 100 {
		return LeaderboardQuery{}, NewQueryValidationError("limit must be an integer between 1 and 100.")
	}
	if visibility != "verified" && visibility != "all" {
		return LeaderboardQuery{}, NewQueryValidationError("Unsupported leaderboard visibility: " + visibility)
	}
	return LeaderboardQuery{Metric: metric, Period: period, Limit: int(limit), Visibility: visibility}, nil
}

// jsNumberInteger emulates Number(s) followed by Number.isInteger for the
// cases that can yield an in-range integer: decimal/exponent forms, hex/octal/binary
// literals, surrounding whitespace, and empty string (=> 0).
func jsNumberInteger(s string) (int64, bool) {
	t := players.JSTrim(s)
	if t == "" {
		return 0, true
	}
	var f float64
	switch {
	case len(t) > 2 && t[0] == '0' && (t[1] == 'x' || t[1] == 'X'):
		u, err := strconv.ParseUint(t[2:], 16, 64)
		if err != nil || strings.ContainsAny(t[2:], "_+-") {
			return 0, false
		}
		f = float64(u)
	case len(t) > 2 && t[0] == '0' && (t[1] == 'o' || t[1] == 'O'):
		u, err := strconv.ParseUint(t[2:], 8, 64)
		if err != nil || strings.ContainsAny(t[2:], "_+-") {
			return 0, false
		}
		f = float64(u)
	case len(t) > 2 && t[0] == '0' && (t[1] == 'b' || t[1] == 'B'):
		u, err := strconv.ParseUint(t[2:], 2, 64)
		if err != nil || strings.ContainsAny(t[2:], "_+-") {
			return 0, false
		}
		f = float64(u)
	default:
		// Reject forms Go accepts but JS StringToNumber does not.
		lower := strings.ToLower(t)
		if strings.ContainsAny(lower, "_") || strings.Contains(lower, "x") || strings.Contains(lower, "p") ||
			strings.Contains(lower, "n") || (strings.Contains(lower, "i") && !strings.HasPrefix(strings.TrimLeft(lower, "+-"), "infinity")) {
			return 0, false
		}
		v, err := strconv.ParseFloat(t, 64)
		if err != nil {
			// out of range yields +-Inf which is not an integer
			return 0, false
		}
		f = v
	}
	if f != f || f > 1e15 || f < -1e15 || f != float64(int64(f)) {
		return 0, false
	}
	return int64(f), true
}

// GetMetricValue mirrors getMetricValue.
func GetMetricValue(m LeaderboardMetrics, metric string) int64 {
	if metric == "totalCapacity" {
		return m.TotalCapacity()
	}
	v, _ := m.Get(metric)
	return v
}

// QueryLeaderboard mirrors queryLeaderboard.
func QueryLeaderboard(ctx context.Context, pr players.PlayersRepository, lr LeaderboardRepository, query LeaderboardQuery) ([]LeaderboardEntry, error) {
	runs, err := lr.ListRuns(ctx, query)
	if err != nil {
		return nil, err
	}
	entries := make([]LeaderboardEntry, 0, len(runs))
	for i, run := range runs {
		p, err := pr.FindByPlayerID(ctx, run.PlayerID)
		if err != nil {
			return nil, err
		}
		username := "Unknown Player"
		if p != nil {
			username = p.Username
		}
		entries = append(entries, LeaderboardEntry{
			Rank: i + 1, PlayerID: run.PlayerID, Username: username, Metric: query.Metric,
			Value: GetMetricValue(run.Metrics, query.Metric), SubmittedAt: run.SubmittedAt,
			GameMonth: run.GameMonth, Metrics: run.Metrics,
		})
	}
	return entries, nil
}
