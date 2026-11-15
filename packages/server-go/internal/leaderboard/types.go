// Package leaderboard ports packages/server/src/leaderboard.
package leaderboard

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"time"
)

// LeaderboardMetricKeys mirrors LEADERBOARD_METRIC_KEYS (game-logic) in order.
var LeaderboardMetricKeys = []string{
	"money", "cumulativeRevenue", "totalServers", "computeCapacity",
	"memoryCapacity", "storageCapacity", "gpuCapacity",
}

// LeaderboardMetrics mirrors game-logic LeaderboardMetrics. All values are
// integral (game-logic rounds them; the DB stores bigint).
type LeaderboardMetrics struct {
	Money             int64 `json:"money"`
	CumulativeRevenue int64 `json:"cumulativeRevenue"`
	TotalServers      int64 `json:"totalServers"`
	ComputeCapacity   int64 `json:"computeCapacity"`
	MemoryCapacity    int64 `json:"memoryCapacity"`
	StorageCapacity   int64 `json:"storageCapacity"`
	GpuCapacity       int64 `json:"gpuCapacity"`
}

// Get returns the metric value for one of LeaderboardMetricKeys.
func (m LeaderboardMetrics) Get(key string) (int64, bool) {
	switch key {
	case "money":
		return m.Money, true
	case "cumulativeRevenue":
		return m.CumulativeRevenue, true
	case "totalServers":
		return m.TotalServers, true
	case "computeCapacity":
		return m.ComputeCapacity, true
	case "memoryCapacity":
		return m.MemoryCapacity, true
	case "storageCapacity":
		return m.StorageCapacity, true
	case "gpuCapacity":
		return m.GpuCapacity, true
	}
	return 0, false
}

// TotalCapacity mirrors totalLeaderboardCapacity.
func (m LeaderboardMetrics) TotalCapacity() int64 {
	return m.ComputeCapacity + m.MemoryCapacity + m.StorageCapacity + m.GpuCapacity
}

type VerificationStatus string

const (
	VerificationUnverified VerificationStatus = "unverified"
	VerificationVerified   VerificationStatus = "verified"
)

// VerifiedRunCheckpointGenesis is the validated optional genesis of a submission.
type VerifiedRunCheckpointGenesis struct {
	Seed       int64  `json:"seed"`
	Difficulty string `json:"difficulty"`
	RulesetID  string `json:"rulesetId"`
}

// Action is a validated leaderboard verification action (JSON object, keys as in
// game-logic; numbers are float64).
type Action map[string]any

// VerifiedRunCheckpointSubmission is the parsed submission. Genesis is nil when omitted.
// ParentHeadHash is nil for JSON null.
type VerifiedRunCheckpointSubmission struct {
	PlayerID       string
	ClientRunID    string
	Genesis        *VerifiedRunCheckpointGenesis
	ParentHeadHash *string
	Actions        []Action
}

// LeaderboardRunRecord is a leaderboard run row.
type LeaderboardRunRecord struct {
	RunID              string             `json:"runId"`
	PlayerID           string             `json:"playerId"`
	ClientRunID        string             `json:"clientRunId"`
	VerificationStatus VerificationStatus `json:"verificationStatus"`
	Metrics            LeaderboardMetrics `json:"metrics"`
	GameMonth          int                `json:"gameMonth"`
	SubmittedAt        time.Time          `json:"submittedAt"`
	UpdatedAt          time.Time          `json:"updatedAt"`
}

// CreateLeaderboardRunInput mirrors TS; zero SubmittedAt/UpdatedAt default as in TS.
type CreateLeaderboardRunInput struct {
	RunID              string
	PlayerID           string
	ClientRunID        string
	VerificationStatus VerificationStatus
	Metrics            LeaderboardMetrics
	GameMonth          int
	SubmittedAt        time.Time
	UpdatedAt          time.Time
}

// VerifiedLeaderboardRunHeadRecord is the verified head row. GenesisDescriptor and
// AuthoritativeState are opaque JSON owned by the JS runtime.
type VerifiedLeaderboardRunHeadRecord struct {
	PlayerID           string          `json:"playerId"`
	ClientRunID        string          `json:"clientRunId"`
	ProtocolVersion    string          `json:"protocolVersion"`
	RulesetID          string          `json:"rulesetId"`
	GenesisDescriptor  json.RawMessage `json:"genesisDescriptor"`
	RootHash           string          `json:"rootHash"`
	HeadHash           string          `json:"headHash"`
	StateHash          string          `json:"stateHash"`
	PreviousHeadHash   *string         `json:"previousHeadHash"`
	LastRequestHash    string          `json:"lastRequestHash"`
	AuthoritativeState json.RawMessage `json:"authoritativeState"`
	GameMonth          int             `json:"gameMonth"`
	Revision           int             `json:"revision"`
	CreatedAt          time.Time       `json:"createdAt"`
	UpdatedAt          time.Time       `json:"updatedAt"`
}

// CommitVerifiedRunInput mirrors TS. Head.Revision/CreatedAt/UpdatedAt are ignored
// by repositories (set by them).
type CommitVerifiedRunInput struct {
	ExpectedParentHeadHash *string
	Run                    LeaderboardRunRecord
	Head                   VerifiedLeaderboardRunHeadRecord
}

// VerifiedRunCommitResult is the result of CommitVerifiedRun.
type VerifiedRunCommitResult struct {
	Created bool
	Run     LeaderboardRunRecord
	Head    VerifiedLeaderboardRunHeadRecord
}

// LeaderboardRepository mirrors the TS interface. FindRunHead returns (nil, nil)
// when absent. CommitVerifiedRun returns *StaleRunHeadError on parent mismatch.
type LeaderboardRepository interface {
	FindRunHead(ctx context.Context, playerID, clientRunID string) (*VerifiedLeaderboardRunHeadRecord, error)
	CommitVerifiedRun(ctx context.Context, input CommitVerifiedRunInput) (*VerifiedRunCommitResult, error)
	ListRuns(ctx context.Context, query LeaderboardQuery) ([]LeaderboardRunRecord, error)
}

// Error codes (equal to the TS `code` values).
const (
	CodeInvalidVerifiedRun      = "INVALID_VERIFIED_RUN"
	CodePlayerNotFound          = "PLAYER_NOT_FOUND"
	CodeUnknownRunHead          = "UNKNOWN_RUN_HEAD"
	CodeStaleRunHead            = "STALE_RUN_HEAD"
	CodeRunRulesetUnsupported   = "RUN_RULESET_UNSUPPORTED"
	CodeRunTickGapExceeded      = "RUN_TICK_GAP_EXCEEDED"
	CodeRunReplayRejected       = "RUN_REPLAY_REJECTED"
	CodeInvalidLeaderboardQuery = "INVALID_LEADERBOARD_QUERY"
)

// Typed errors. Each has Code and Message; use errors.As with the pointer type.
type (
	ValidationError         struct{ Code, Message string }
	PlayerNotFoundError     struct{ Code, Message string }
	UnknownRunHeadError     struct{ Code, Message string }
	StaleRunHeadError       struct{ Code, Message string }
	RulesetUnsupportedError struct{ Code, Message string }
	TickGapExceededError    struct{ Code, Message string }
	ReplayRejectedError     struct{ Code, Message string }
	QueryValidationError    struct{ Code, Message string }
)

func (e *ValidationError) Error() string         { return e.Message }
func (e *PlayerNotFoundError) Error() string     { return e.Message }
func (e *UnknownRunHeadError) Error() string     { return e.Message }
func (e *StaleRunHeadError) Error() string       { return e.Message }
func (e *RulesetUnsupportedError) Error() string { return e.Message }
func (e *TickGapExceededError) Error() string    { return e.Message }
func (e *ReplayRejectedError) Error() string     { return e.Message }
func (e *QueryValidationError) Error() string    { return e.Message }

func NewValidationError(m string) *ValidationError {
	return &ValidationError{CodeInvalidVerifiedRun, m}
}
func NewPlayerNotFoundError(m string) *PlayerNotFoundError {
	return &PlayerNotFoundError{CodePlayerNotFound, m}
}
func NewUnknownRunHeadError(m string) *UnknownRunHeadError {
	return &UnknownRunHeadError{CodeUnknownRunHead, m}
}
func NewStaleRunHeadError(m string) *StaleRunHeadError {
	return &StaleRunHeadError{CodeStaleRunHead, m}
}
func NewRulesetUnsupportedError(m string) *RulesetUnsupportedError {
	return &RulesetUnsupportedError{CodeRunRulesetUnsupported, m}
}
func NewTickGapExceededError(m string) *TickGapExceededError {
	return &TickGapExceededError{CodeRunTickGapExceeded, m}
}
func NewReplayRejectedError(m string) *ReplayRejectedError {
	return &ReplayRejectedError{CodeRunReplayRejected, m}
}
func NewQueryValidationError(m string) *QueryValidationError {
	return &QueryValidationError{CodeInvalidLeaderboardQuery, m}
}

// GenerateLeaderboardRunID returns "run_" + 32 hex chars of a random UUIDv4 (dashes removed).
func GenerateLeaderboardRunID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		panic(err)
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return "run_" + hex.EncodeToString(b[:])
}

// CreateLeaderboardRunRecord mirrors createLeaderboardRunRecord.
func CreateLeaderboardRunRecord(in CreateLeaderboardRunInput) LeaderboardRunRecord {
	submittedAt := in.SubmittedAt
	if submittedAt.IsZero() {
		submittedAt = time.Now()
	}
	updatedAt := in.UpdatedAt
	if updatedAt.IsZero() {
		updatedAt = submittedAt
	}
	return LeaderboardRunRecord{
		RunID: in.RunID, PlayerID: in.PlayerID, ClientRunID: in.ClientRunID,
		VerificationStatus: in.VerificationStatus, Metrics: in.Metrics, GameMonth: in.GameMonth,
		SubmittedAt: submittedAt, UpdatedAt: updatedAt,
	}
}
