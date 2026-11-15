package players

import (
	"context"
	"sync"
	"time"
)

// PlayersRepository mirrors the TS interface. Find* return (nil, nil) when not found.
// TouchPlayer with a zero seenAt uses time.Now().
type PlayersRepository interface {
	FindByNormalizedUsername(ctx context.Context, normalizedUsername string) (*RegisteredPlayer, error)
	FindByPlayerID(ctx context.Context, playerID string) (*RegisteredPlayer, error)
	// CreatePlayer parses/validates the username; returns *UsernameValidationError or *UsernameUnavailableError.
	CreatePlayer(ctx context.Context, input RegisterPlayerInput) (*RegisteredPlayer, error)
	TouchPlayer(ctx context.Context, playerID string, seenAt time.Time) error
}

// InMemoryPlayersRepository is a goroutine-safe in-memory PlayersRepository.
type InMemoryPlayersRepository struct {
	mu       sync.Mutex
	byID     map[string]RegisteredPlayer
	idByNorm map[string]string
}

func NewInMemoryPlayersRepository() *InMemoryPlayersRepository {
	return &InMemoryPlayersRepository{byID: map[string]RegisteredPlayer{}, idByNorm: map[string]string{}}
}

func (r *InMemoryPlayersRepository) FindByNormalizedUsername(_ context.Context, n string) (*RegisteredPlayer, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if id, ok := r.idByNorm[n]; ok {
		if p, ok := r.byID[id]; ok {
			return &p, nil
		}
	}
	return nil, nil
}

func (r *InMemoryPlayersRepository) FindByPlayerID(_ context.Context, id string) (*RegisteredPlayer, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if p, ok := r.byID[id]; ok {
		return &p, nil
	}
	return nil, nil
}

func (r *InMemoryPlayersRepository) CreatePlayer(_ context.Context, input RegisterPlayerInput) (*RegisteredPlayer, error) {
	parsed, err := ParseUsernameRegistration(input.Username)
	if err != nil {
		return nil, err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, taken := r.idByNorm[parsed.NormalizedUsername]; taken {
		return nil, NewUsernameUnavailableError()
	}
	p := CreateRegisteredPlayer(CreatePlayerInput{
		PlayerID: GeneratePlayerID(), Username: parsed.Username, NormalizedUsername: parsed.NormalizedUsername,
	})
	r.byID[p.PlayerID] = p
	r.idByNorm[p.NormalizedUsername] = p.PlayerID
	return &p, nil
}

func (r *InMemoryPlayersRepository) TouchPlayer(_ context.Context, id string, seenAt time.Time) error {
	if seenAt.IsZero() {
		seenAt = time.Now()
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if p, ok := r.byID[id]; ok {
		p.LastSeenAt = seenAt
		r.byID[id] = p
	}
	return nil
}
