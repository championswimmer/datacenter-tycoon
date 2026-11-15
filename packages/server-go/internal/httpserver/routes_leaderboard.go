package httpserver

import (
	"fmt"
	"net/http"

	"github.com/championswimmer/datacenter-tycoon/server-go/internal/leaderboard"
)

func errLeaderboardUnavailable() error {
	return NewHTTPError(503, "LEADERBOARD_UNAVAILABLE", "Online leaderboard submission is not configured.")
}

type leaderboardResponse struct {
	Metric     string                         `json:"metric"`
	Period     string                         `json:"period"`
	Limit      int                            `json:"limit"`
	Visibility string                         `json:"visibility"`
	Entries    []leaderboard.LeaderboardEntry `json:"entries"`
}

func (a *app) leaderboardList(w http.ResponseWriter, r *http.Request) error {
	if a.deps.Players == nil || a.deps.Leaderboard == nil {
		return errLeaderboardUnavailable()
	}
	result, err := leaderboard.QueryLeaderboardEntries(
		r.Context(), a.deps.Players, a.deps.Leaderboard, parseSearchParams(r.URL.RawQuery))
	if err != nil {
		return err
	}
	entries := result.Entries
	if entries == nil {
		entries = []leaderboard.LeaderboardEntry{}
	}
	writeJSON(w, r, http.StatusOK, leaderboardResponse{
		Metric:     result.Query.Metric,
		Period:     result.Query.Period,
		Limit:      result.Query.Limit,
		Visibility: result.Query.Visibility,
		Entries:    entries,
	})
	return nil
}

func (a *app) leaderboardSubmit(w http.ResponseWriter, r *http.Request) error {
	if a.deps.Players == nil || a.deps.Leaderboard == nil {
		return errLeaderboardUnavailable()
	}
	if a.deps.RateLimiter != nil {
		if err := a.enforceClientRateLimit(r, "leaderboard submissions", a.cfg.RateLimits.LeaderboardSubmission); err != nil {
			return err
		}
	}

	limit := a.cfg.LeaderboardVerification.MaxRequestBodyBytes
	body, err := readBody(r, limit)
	if err != nil {
		return invalidJSON()
	}
	if int64(len(body)) > limit {
		return NewHTTPError(400, "INVALID_VERIFIED_RUN", fmt.Sprintf(
			"Verified leaderboard submission body exceeds the limit of %d bytes.", limit))
	}
	var payload any
	if len(body) > 0 {
		payload, err = leaderboard.DecodeJSON(body)
		if err != nil {
			return invalidJSON()
		}
	}

	if a.deps.Engine == nil {
		return fmt.Errorf("game-logic runtime is not available")
	}
	v := a.cfg.LeaderboardVerification
	result, err := leaderboard.SubmitLeaderboardRun(
		r.Context(), a.deps.Engine, a.deps.Players, a.deps.Leaderboard, payload,
		leaderboard.VerificationConfig{
			ProtocolVersion: v.ProtocolVersion,
			RulesetID:       v.RulesetID,
			MaxActionCount:  int(v.MaxActionCount),
			MaxTickDelta:    int(v.MaxTickDelta),
		})
	if err != nil {
		return err
	}
	status := http.StatusOK
	if result.Created {
		status = http.StatusCreated
	}
	writeJSON(w, r, status, result)
	return nil
}
