package leaderboard

import (
	"context"
	"errors"
	"net/url"
	"time"

	"github.com/championswimmer/datacenter-tycoon/server-go/internal/players"
)

// StatusError is the (status, code, message) error the HTTP layer renders; shared with players.
type StatusError = players.StatusError

// QueryResult is the result of QueryLeaderboardEntries.
type QueryResult struct {
	Query   LeaderboardQuery
	Entries []LeaderboardEntry
}

// QueryLeaderboardEntries mirrors queryLeaderboardEntries.
func QueryLeaderboardEntries(ctx context.Context, pr players.PlayersRepository, lr LeaderboardRepository, params url.Values) (*QueryResult, error) {
	query, err := ParseLeaderboardQuery(params)
	if err != nil {
		return nil, NormalizeLeaderboardError(err)
	}
	entries, err := QueryLeaderboard(ctx, pr, lr, query)
	if err != nil {
		return nil, NormalizeLeaderboardError(err)
	}
	return &QueryResult{Query: query, Entries: entries}, nil
}

// SubmitLeaderboardRun mirrors submitLeaderboardRun. payload is a DecodeJSON result.
// Returned errors that are domain errors are *StatusError; anything else is an internal error (500).
func SubmitLeaderboardRun(
	ctx context.Context, engine Engine, pr players.PlayersRepository, lr LeaderboardRepository,
	payload any, cfg VerificationConfig,
) (*VerifiedCheckpointResponse, error) {
	submission, err := ParseVerifiedRunCheckpointSubmission(payload)
	if err != nil {
		return nil, NormalizeLeaderboardError(err)
	}
	player, err := pr.FindByPlayerID(ctx, submission.PlayerID)
	if err != nil {
		return nil, NormalizeLeaderboardError(err)
	}
	if player == nil {
		return nil, NormalizeLeaderboardError(NewPlayerNotFoundError("Unknown player id: " + submission.PlayerID))
	}
	result, err := SubmitVerifiedCheckpoint(ctx, engine, lr, player, submission, cfg)
	if err != nil {
		return nil, NormalizeLeaderboardError(err)
	}
	if err := pr.TouchPlayer(ctx, submission.PlayerID, time.Time{}); err != nil {
		return nil, NormalizeLeaderboardError(err)
	}
	return result, nil
}

// NormalizeLeaderboardError maps typed domain errors to *StatusError like normalizeLeaderboardError.
func NormalizeLeaderboardError(err error) error {
	var (
		validation  *ValidationError
		query       *QueryValidationError
		notFound    *PlayerNotFoundError
		unknownHead *UnknownRunHeadError
		stale       *StaleRunHeadError
		ruleset     *RulesetUnsupportedError
		tickGap     *TickGapExceededError
		replay      *ReplayRejectedError
	)
	switch {
	case errors.As(err, &validation):
		return players.NewStatusError(400, validation.Code, validation.Message)
	case errors.As(err, &query):
		return players.NewStatusError(400, query.Code, query.Message)
	case errors.As(err, &notFound):
		return players.NewStatusError(404, notFound.Code, notFound.Message)
	case errors.As(err, &unknownHead):
		return players.NewStatusError(404, unknownHead.Code, unknownHead.Message)
	case errors.As(err, &stale):
		return players.NewStatusError(409, stale.Code, stale.Message)
	case errors.As(err, &ruleset):
		return players.NewStatusError(409, ruleset.Code, ruleset.Message)
	case errors.As(err, &tickGap):
		return players.NewStatusError(409, tickGap.Code, tickGap.Message)
	case errors.As(err, &replay):
		return players.NewStatusError(409, replay.Code, replay.Message)
	}
	return err
}
