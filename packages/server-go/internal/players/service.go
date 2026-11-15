package players

import (
	"context"
	"errors"
)

// StatusError mirrors the TS HttpError (status, code, message) produced by the
// service layers. The HTTP layer should map it to {error:{code,message}} responses.
type StatusError struct {
	Status  int
	Code    string
	Message string
}

func (e *StatusError) Error() string { return e.Message }

// NewStatusError builds a StatusError.
func NewStatusError(status int, code, message string) *StatusError {
	return &StatusError{Status: status, Code: code, Message: message}
}

// AvailabilityResult is the body of GET /players/availability.
type AvailabilityResult struct {
	Username  string `json:"username"`
	Available bool   `json:"available"`
}

// RegisteredResult is the body of POST /players.
type RegisteredResult struct {
	PlayerID string `json:"playerId"`
	Username string `json:"username"`
}

// CheckUsernameAvailability mirrors checkUsernameAvailability.
func CheckUsernameAvailability(ctx context.Context, repo PlayersRepository, rawUsername string) (*AvailabilityResult, error) {
	parsed, err := ParseUsernameRegistration(rawUsername)
	if err != nil {
		return nil, normalizePlayerError(err)
	}
	existing, err := repo.FindByNormalizedUsername(ctx, parsed.NormalizedUsername)
	if err != nil {
		return nil, normalizePlayerError(err)
	}
	return &AvailabilityResult{Username: parsed.Username, Available: existing == nil}, nil
}

// RegisterPlayerUsername mirrors registerPlayerUsername.
func RegisterPlayerUsername(ctx context.Context, repo PlayersRepository, rawUsername string) (*RegisteredResult, error) {
	parsed, err := ParseUsernameRegistration(rawUsername)
	if err != nil {
		return nil, normalizePlayerError(err)
	}
	p, err := repo.CreatePlayer(ctx, RegisterPlayerInput{Username: parsed.Username})
	if err != nil {
		return nil, normalizePlayerError(err)
	}
	return &RegisteredResult{PlayerID: p.PlayerID, Username: p.Username}, nil
}

func normalizePlayerError(err error) error {
	var unavailable *UsernameUnavailableError
	if errors.As(err, &unavailable) {
		return NewStatusError(409, "USERNAME_UNAVAILABLE", unavailable.Message)
	}
	var invalid *UsernameValidationError
	if errors.As(err, &invalid) {
		return NewStatusError(400, invalid.Code, invalid.Message)
	}
	return err
}
