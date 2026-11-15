package leaderboard

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/championswimmer/datacenter-tycoon/server-go/internal/players"
	"github.com/championswimmer/datacenter-tycoon/server-go/jsbridge"
)

// VerificationConfig mirrors ServerConfig["leaderboardVerification"].
type VerificationConfig struct {
	ProtocolVersion string
	RulesetID       string
	MaxActionCount  int
	MaxTickDelta    int
}

// Engine is the game-logic runtime used for hashing/replay; *jsbridge.Runtime implements it.
type Engine interface {
	SHA256Canonical(value any) (string, error)
	Genesis(descriptor any) (json.RawMessage, error)
	Replay(state, actions any) (*jsbridge.ReplayResult, error)
	Summarize(state any) (jsbridge.Summary, error)
}

var _ Engine = (*jsbridge.Runtime)(nil)

// VerifiedCheckpointResponse is the body of a successful submission (key order as TS).
type VerifiedCheckpointResponse struct {
	Created   bool               `json:"created"`
	RootHash  string             `json:"rootHash"`
	HeadHash  string             `json:"headHash"`
	GameMonth int                `json:"gameMonth"`
	Metrics   LeaderboardMetrics `json:"metrics"`
}

func strPtrEq(a, b *string) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}

// SubmitVerifiedCheckpoint mirrors submitVerifiedCheckpoint.
func SubmitVerifiedCheckpoint(
	ctx context.Context, engine Engine, repo LeaderboardRepository,
	player *players.RegisteredPlayer, submission *VerifiedRunCheckpointSubmission, cfg VerificationConfig,
) (*VerifiedCheckpointResponse, error) {
	if len(submission.Actions) > cfg.MaxActionCount {
		return nil, NewValidationError(fmt.Sprintf("actions may contain at most %d entries.", cfg.MaxActionCount))
	}

	existing, err := repo.FindRunHead(ctx, submission.PlayerID, submission.ClientRunID)
	if err != nil {
		return nil, err
	}
	requestHash, err := engine.SHA256Canonical(map[string]any{
		"parentHeadHash": submission.ParentHeadHash,
		"actions":        submission.Actions,
	})
	if err != nil {
		return nil, err
	}

	if existing != nil {
		if strPtrEq(existing.PreviousHeadHash, submission.ParentHeadHash) && existing.LastRequestHash == requestHash {
			return responseFromHead(engine, existing)
		}
		if submission.Genesis != nil {
			return nil, NewValidationError("genesis must be omitted after the server has accepted a verified run head.")
		}
		if submission.ParentHeadHash == nil || *submission.ParentHeadHash != existing.HeadHash {
			return nil, NewStaleRunHeadError(fmt.Sprintf("Run %s expected parent %s, received %s.",
				submission.ClientRunID, existing.HeadHash, jsString(submission.ParentHeadHash)))
		}
		return commitReplay(ctx, engine, repo, player, submission, cfg, existing, requestHash)
	}

	if submission.Genesis == nil {
		return nil, NewUnknownRunHeadError(fmt.Sprintf(
			"Run %s has no accepted verified head yet; genesis is required.", submission.ClientRunID))
	}
	if submission.ParentHeadHash != nil {
		return nil, NewUnknownRunHeadError(fmt.Sprintf(
			"Run %s cannot continue from unknown parent %s.", submission.ClientRunID, *submission.ParentHeadHash))
	}
	if submission.Genesis.RulesetID != cfg.RulesetID {
		return nil, NewRulesetUnsupportedError(fmt.Sprintf("Unsupported verified-run ruleset: %s.", submission.Genesis.RulesetID))
	}
	return commitReplay(ctx, engine, repo, player, submission, cfg, nil, requestHash)
}

func responseFromHead(engine Engine, head *VerifiedLeaderboardRunHeadRecord) (*VerifiedCheckpointResponse, error) {
	summary, err := engine.Summarize(head.AuthoritativeState)
	if err != nil {
		return nil, err
	}
	return &VerifiedCheckpointResponse{
		Created: false, RootHash: head.RootHash, HeadHash: head.HeadHash,
		GameMonth: summary.GameMonth, Metrics: LeaderboardMetrics(summary.Metrics),
	}, nil
}

func commitReplay(
	ctx context.Context, engine Engine, repo LeaderboardRepository, player *players.RegisteredPlayer,
	submission *VerifiedRunCheckpointSubmission, cfg VerificationConfig,
	existing *VerifiedLeaderboardRunHeadRecord, requestHash string,
) (*VerifiedCheckpointResponse, error) {
	var genesisDescriptor json.RawMessage
	var initialState json.RawMessage
	if existing != nil {
		genesisDescriptor, initialState = existing.GenesisDescriptor, existing.AuthoritativeState
	} else {
		d, err := json.Marshal(struct {
			Seed       int64  `json:"seed"`
			Difficulty string `json:"difficulty"`
			GameID     string `json:"gameId"`
			PlayerName string `json:"playerName"`
		}{submission.Genesis.Seed, submission.Genesis.Difficulty, submission.ClientRunID, player.Username})
		if err != nil {
			return nil, err
		}
		genesisDescriptor = d
		if initialState, err = engine.Genesis(genesisDescriptor); err != nil {
			return nil, err
		}
	}
	var tickProbe struct {
		Tick int `json:"tick"`
	}
	if err := json.Unmarshal(initialState, &tickProbe); err != nil {
		return nil, fmt.Errorf("decode state tick: %w", err)
	}
	previousTick := tickProbe.Tick

	var rootHash string
	if existing != nil {
		rootHash = existing.RootHash
	} else {
		h, err := engine.SHA256Canonical(map[string]any{
			"protocolVersion":   cfg.ProtocolVersion,
			"rulesetId":         cfg.RulesetID,
			"genesisDescriptor": genesisDescriptor,
			"genesisState":      initialState,
		})
		if err != nil {
			return nil, err
		}
		rootHash = h
	}

	replayed, err := engine.Replay(initialState, submission.Actions)
	if err != nil {
		var rejected *jsbridge.ReplayRejectedError
		if errors.As(err, &rejected) {
			return nil, NewReplayRejectedError(rejected.Message)
		}
		return nil, err
	}

	tickDelta := replayed.Summary.GameMonth - previousTick
	if tickDelta > cfg.MaxTickDelta {
		return nil, NewTickGapExceededError(fmt.Sprintf(
			"Verified replay advanced %d completed month(s), exceeding the limit of %d.", tickDelta, cfg.MaxTickDelta))
	}

	stateHash, err := engine.SHA256Canonical(replayed.State)
	if err != nil {
		return nil, err
	}
	headHash, err := engine.SHA256Canonical(map[string]any{
		"rootHash":       rootHash,
		"parentHeadHash": submission.ParentHeadHash,
		"requestHash":    requestHash,
		"stateHash":      stateHash,
	})
	if err != nil {
		return nil, err
	}

	metrics := LeaderboardMetrics(replayed.Summary.Metrics)
	committed, err := repo.CommitVerifiedRun(ctx, CommitVerifiedRunInput{
		ExpectedParentHeadHash: submission.ParentHeadHash,
		Run: CreateLeaderboardRunRecord(CreateLeaderboardRunInput{
			RunID: "placeholder", PlayerID: submission.PlayerID, ClientRunID: submission.ClientRunID,
			VerificationStatus: VerificationVerified, Metrics: metrics, GameMonth: replayed.Summary.GameMonth,
			UpdatedAt: time.Now(),
		}),
		Head: VerifiedLeaderboardRunHeadRecord{
			PlayerID: submission.PlayerID, ClientRunID: submission.ClientRunID,
			ProtocolVersion: cfg.ProtocolVersion, RulesetID: cfg.RulesetID,
			GenesisDescriptor: genesisDescriptor, RootHash: rootHash, HeadHash: headHash, StateHash: stateHash,
			PreviousHeadHash: submission.ParentHeadHash, LastRequestHash: requestHash,
			AuthoritativeState: replayed.State, GameMonth: replayed.Summary.GameMonth,
		},
	})
	if err != nil {
		var stale *StaleRunHeadError
		if errors.As(err, &stale) {
			current, ferr := repo.FindRunHead(ctx, submission.PlayerID, submission.ClientRunID)
			if ferr != nil {
				return nil, ferr
			}
			if current != nil && strPtrEq(current.PreviousHeadHash, submission.ParentHeadHash) && current.LastRequestHash == requestHash {
				return responseFromHead(engine, current)
			}
		}
		return nil, err
	}

	return &VerifiedCheckpointResponse{
		Created: committed.Created, RootHash: committed.Head.RootHash, HeadHash: committed.Head.HeadHash,
		GameMonth: committed.Run.GameMonth, Metrics: committed.Run.Metrics,
	}, nil
}
