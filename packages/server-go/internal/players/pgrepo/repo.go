// Package pgrepo is the Postgres (pgx) implementation of players.PlayersRepository.
// Mirrors packages/server/src/players/drizzle-repository.ts.
package pgrepo

import (
	"context"
	"errors"
	"time"

	"github.com/championswimmer/datacenter-tycoon/server-go/internal/players"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Repository implements players.PlayersRepository on Postgres.
type Repository struct {
	pool *pgxpool.Pool
}

var _ players.PlayersRepository = (*Repository)(nil)

// New returns a Postgres-backed players repository.
func New(pool *pgxpool.Pool) *Repository { return &Repository{pool: pool} }

const selectCols = `id, username, normalized_username, created_at, last_seen_at`

func scan(row pgx.Row) (*players.RegisteredPlayer, error) {
	var p players.RegisteredPlayer
	if err := row.Scan(&p.PlayerID, &p.Username, &p.NormalizedUsername, &p.CreatedAt, &p.LastSeenAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	p.CreatedAt, p.LastSeenAt = p.CreatedAt.UTC(), p.LastSeenAt.UTC()
	return &p, nil
}

func (r *Repository) FindByNormalizedUsername(ctx context.Context, normalizedUsername string) (*players.RegisteredPlayer, error) {
	return scan(r.pool.QueryRow(ctx, `SELECT `+selectCols+` FROM players WHERE normalized_username = $1 LIMIT 1`, normalizedUsername))
}

func (r *Repository) FindByPlayerID(ctx context.Context, playerID string) (*players.RegisteredPlayer, error) {
	return scan(r.pool.QueryRow(ctx, `SELECT `+selectCols+` FROM players WHERE id = $1 LIMIT 1`, playerID))
}

// CreatePlayer validates the username, then inserts with ON CONFLICT DO NOTHING
// on normalized_username; a conflict yields *players.UsernameUnavailableError.
func (r *Repository) CreatePlayer(ctx context.Context, input players.RegisterPlayerInput) (*players.RegisteredPlayer, error) {
	parsed, err := players.ParseUsernameRegistration(input.Username)
	if err != nil {
		return nil, err
	}
	p := players.CreateRegisteredPlayer(players.CreatePlayerInput{
		PlayerID:           players.GeneratePlayerID(),
		Username:           parsed.Username,
		NormalizedUsername: parsed.NormalizedUsername,
	})
	created, err := scan(r.pool.QueryRow(ctx,
		`INSERT INTO players (id, username, normalized_username, created_at, last_seen_at)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (normalized_username) DO NOTHING
		 RETURNING `+selectCols,
		p.PlayerID, p.Username, p.NormalizedUsername, msTime(p.CreatedAt), msTime(p.LastSeenAt)))
	if err != nil {
		return nil, err
	}
	if created == nil {
		return nil, players.NewUsernameUnavailableError()
	}
	return created, nil
}

// TouchPlayer updates last_seen_at; a zero seenAt means now. Unknown ids are a no-op.
func (r *Repository) TouchPlayer(ctx context.Context, playerID string, seenAt time.Time) error {
	if seenAt.IsZero() {
		seenAt = time.Now()
	}
	_, err := r.pool.Exec(ctx, `UPDATE players SET last_seen_at = $1 WHERE id = $2`, msTime(seenAt), playerID)
	return err
}

// msTime truncates to millisecond precision (JS Date resolution used by the TS server).
func msTime(t time.Time) time.Time { return t.Truncate(time.Millisecond) }
