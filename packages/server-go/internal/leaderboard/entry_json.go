package leaderboard

import (
	"encoding/json"
	"time"
)

// FormatJSTime formats like JS Date.toISOString (UTC, millisecond precision).
func FormatJSTime(t time.Time) string {
	return t.UTC().Format("2006-01-02T15:04:05.000Z")
}

// MarshalJSON matches the TS serializeLeaderboardEntry key order and date format.
func (e LeaderboardEntry) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Rank        int                `json:"rank"`
		PlayerID    string             `json:"playerId"`
		Username    string             `json:"username"`
		Metric      string             `json:"metric"`
		Value       int64              `json:"value"`
		SubmittedAt string             `json:"submittedAt"`
		GameMonth   int                `json:"gameMonth"`
		Metrics     LeaderboardMetrics `json:"metrics"`
	}{e.Rank, e.PlayerID, e.Username, e.Metric, e.Value, FormatJSTime(e.SubmittedAt), e.GameMonth, e.Metrics})
}
