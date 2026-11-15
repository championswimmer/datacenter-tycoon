// Package pgrepo is the Postgres (pgx) implementation of
// leaderboard.LeaderboardRepository. It mirrors DrizzleLeaderboardRepository in
// packages/server/src/leaderboard/repository.ts.
package pgrepo

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/championswimmer/datacenter-tycoon/server-go/internal/leaderboard"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Repository implements leaderboard.LeaderboardRepository on Postgres.
type Repository struct {
	pool *pgxpool.Pool
}

var _ leaderboard.LeaderboardRepository = (*Repository)(nil)

// New returns a Postgres-backed leaderboard repository.
func New(pool *pgxpool.Pool) *Repository { return &Repository{pool: pool} }

const runCols = `id, player_id, client_run_id, verification_status, money, cumulative_revenue,
	total_servers, compute_capacity, memory_capacity, storage_capacity, gpu_capacity,
	game_month, submitted_at, updated_at`

const headCols = `player_id, client_run_id, protocol_version, ruleset_id, genesis_seed,
	genesis_difficulty, root_hash, head_hash, state_hash, previous_head_hash,
	last_request_hash, game_state_json, game_month, revision, created_at, updated_at`

func scanRun(row pgx.Row) (*leaderboard.LeaderboardRunRecord, error) {
	var r leaderboard.LeaderboardRunRecord
	var status string
	var gameMonth int32
	var totalServers int32
	m := &r.Metrics
	err := row.Scan(&r.RunID, &r.PlayerID, &r.ClientRunID, &status, &m.Money, &m.CumulativeRevenue,
		&totalServers, &m.ComputeCapacity, &m.MemoryCapacity, &m.StorageCapacity, &m.GpuCapacity,
		&gameMonth, &r.SubmittedAt, &r.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	r.VerificationStatus = leaderboard.VerificationStatus(status)
	m.TotalServers = int64(totalServers)
	r.GameMonth = int(gameMonth)
	r.SubmittedAt = r.SubmittedAt.UTC()
	r.UpdatedAt = r.UpdatedAt.UTC()
	return &r, nil
}

// genesisDescriptor is serialised in the same key order as the TS mapper.
type genesisDescriptor struct {
	Seed       json.Number `json:"seed"`
	Difficulty string      `json:"difficulty"`
	GameID     string      `json:"gameId"`
	PlayerName string      `json:"playerName"`
}

func scanHead(row pgx.Row) (*leaderboard.VerifiedLeaderboardRunHeadRecord, error) {
	var h leaderboard.VerifiedLeaderboardRunHeadRecord
	var seed int64
	var difficulty, stateJSON string
	var gameMonth, revision int32
	err := row.Scan(&h.PlayerID, &h.ClientRunID, &h.ProtocolVersion, &h.RulesetID, &seed, &difficulty,
		&h.RootHash, &h.HeadHash, &h.StateHash, &h.PreviousHeadHash, &h.LastRequestHash, &stateJSON,
		&gameMonth, &revision, &h.CreatedAt, &h.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	var state struct {
		Player struct {
			Name string `json:"name"`
		} `json:"player"`
	}
	if err := json.Unmarshal([]byte(stateJSON), &state); err != nil {
		return nil, fmt.Errorf("decode stored game state: %w", err)
	}
	desc, err := json.Marshal(genesisDescriptor{
		Seed: json.Number(fmt.Sprintf("%d", seed)), Difficulty: difficulty,
		GameID: h.ClientRunID, PlayerName: state.Player.Name,
	})
	if err != nil {
		return nil, err
	}
	h.GenesisDescriptor = desc
	h.AuthoritativeState = json.RawMessage(stateJSON)
	h.GameMonth = int(gameMonth)
	h.Revision = int(revision)
	h.CreatedAt = h.CreatedAt.UTC()
	h.UpdatedAt = h.UpdatedAt.UTC()
	return &h, nil
}

func (r *Repository) FindRunHead(ctx context.Context, playerID, clientRunID string) (*leaderboard.VerifiedLeaderboardRunHeadRecord, error) {
	return scanHead(r.pool.QueryRow(ctx,
		`SELECT `+headCols+` FROM verified_leaderboard_run_heads WHERE player_id = $1 AND client_run_id = $2 LIMIT 1`,
		playerID, clientRunID))
}

// CommitVerifiedRun upserts the run row and the verified head in one
// transaction. The head row is locked (FOR UPDATE) while its parent hash is
// checked so concurrent commits cannot both pass the stale-head check. A unique
// violation from a concurrent first insert is reported as a stale head.
func (r *Repository) CommitVerifiedRun(ctx context.Context, input leaderboard.CommitVerifiedRunInput) (*leaderboard.VerifiedRunCommitResult, error) {
	var result *leaderboard.VerifiedRunCommitResult
	err := pgx.BeginFunc(ctx, r.pool, func(tx pgx.Tx) error {
		var existingHead *leaderboard.VerifiedLeaderboardRunHeadRecord
		existingHead, err := scanHead(tx.QueryRow(ctx,
			`SELECT `+headCols+` FROM verified_leaderboard_run_heads WHERE player_id = $1 AND client_run_id = $2 LIMIT 1 FOR UPDATE`,
			input.Run.PlayerID, input.Run.ClientRunID))
		if err != nil {
			return err
		}
		expected := input.ExpectedParentHeadHash
		if existingHead == nil {
			if expected != nil {
				return leaderboard.NewStaleRunHeadError(fmt.Sprintf(
					"Run %s does not have a verified head for parent %s.", input.Run.ClientRunID, *expected))
			}
		} else if expected == nil || existingHead.HeadHash != *expected {
			return leaderboard.NewStaleRunHeadError(fmt.Sprintf(
				"Run %s expected parent %s, current head is %s.", input.Run.ClientRunID, jsString(expected), existingHead.HeadHash))
		}

		existingRun, err := scanRun(tx.QueryRow(ctx,
			`SELECT `+runCols+` FROM leaderboard_runs WHERE player_id = $1 AND client_run_id = $2 LIMIT 1`,
			input.Run.PlayerID, input.Run.ClientRunID))
		if err != nil {
			return err
		}

		m := input.Run.Metrics
		runArgs := []any{
			input.Run.PlayerID, input.Run.ClientRunID, string(input.Run.VerificationStatus),
			m.Money, m.CumulativeRevenue, m.TotalServers, m.ComputeCapacity, m.MemoryCapacity,
			m.StorageCapacity, m.GpuCapacity, input.Run.GameMonth, msTime(input.Run.UpdatedAt),
		}
		var run *leaderboard.LeaderboardRunRecord
		if existingRun != nil {
			run, err = scanRun(tx.QueryRow(ctx, `UPDATE leaderboard_runs SET
				player_id = $1, client_run_id = $2, verification_status = $3, money = $4,
				cumulative_revenue = $5, total_servers = $6, compute_capacity = $7, memory_capacity = $8,
				storage_capacity = $9, gpu_capacity = $10, game_month = $11, updated_at = $12
				WHERE id = $13 RETURNING `+runCols, append(runArgs, existingRun.RunID)...))
		} else {
			// submitted_at is omitted so the column DEFAULT NOW() applies, as in Drizzle.
			run, err = scanRun(tx.QueryRow(ctx, `INSERT INTO leaderboard_runs
				(player_id, client_run_id, verification_status, money, cumulative_revenue, total_servers,
				 compute_capacity, memory_capacity, storage_capacity, gpu_capacity, game_month, updated_at, id)
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING `+runCols,
				append(runArgs, leaderboard.GenerateLeaderboardRunID())...))
		}
		if err != nil {
			return err
		}
		if run == nil {
			return errors.New("expected leaderboard run row to be present")
		}

		var desc struct {
			Seed       json.Number `json:"seed"`
			Difficulty string      `json:"difficulty"`
		}
		if err := json.Unmarshal(input.Head.GenesisDescriptor, &desc); err != nil {
			return fmt.Errorf("decode genesis descriptor: %w", err)
		}
		seed, err := desc.Seed.Int64()
		if err != nil {
			f, ferr := desc.Seed.Float64()
			if ferr != nil {
				return fmt.Errorf("genesis seed: %w", err)
			}
			seed = int64(f)
		}
		h := input.Head
		headArgs := []any{
			h.PlayerID, h.ClientRunID, h.ProtocolVersion, h.RulesetID, seed, desc.Difficulty,
			h.RootHash, h.HeadHash, h.StateHash, h.PreviousHeadHash, h.LastRequestHash,
			string(h.AuthoritativeState), h.GameMonth, time.Now().Truncate(time.Millisecond),
		}
		var head *leaderboard.VerifiedLeaderboardRunHeadRecord
		if existingHead != nil {
			head, err = scanHead(tx.QueryRow(ctx, `UPDATE verified_leaderboard_run_heads SET
				player_id = $1, client_run_id = $2, protocol_version = $3, ruleset_id = $4, genesis_seed = $5,
				genesis_difficulty = $6, root_hash = $7, head_hash = $8, state_hash = $9, previous_head_hash = $10,
				last_request_hash = $11, game_state_json = $12, game_month = $13, updated_at = $14,
				revision = $15
				WHERE player_id = $16 AND client_run_id = $17 RETURNING `+headCols,
				append(headArgs, existingHead.Revision+1, input.Run.PlayerID, input.Run.ClientRunID)...))
		} else {
			// created_at is omitted so DEFAULT NOW() applies.
			head, err = scanHead(tx.QueryRow(ctx, `INSERT INTO verified_leaderboard_run_heads
				(player_id, client_run_id, protocol_version, ruleset_id, genesis_seed, genesis_difficulty,
				 root_hash, head_hash, state_hash, previous_head_hash, last_request_hash, game_state_json,
				 game_month, updated_at, revision)
				VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING `+headCols,
				append(headArgs, 1)...))
		}
		if err != nil {
			return err
		}
		if head == nil {
			return errors.New("expected verified leaderboard head row to be present")
		}
		result = &leaderboard.VerifiedRunCommitResult{Created: existingHead == nil, Run: *run, Head: *head}
		return nil
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" && input.ExpectedParentHeadHash == nil {
			return nil, leaderboard.NewStaleRunHeadError(fmt.Sprintf(
				"Run %s was concurrently created by another submission.", input.Run.ClientRunID))
		}
		return nil, err
	}
	return result, nil
}

var orderColumn = map[string]string{
	"money":             "money",
	"cumulativeRevenue": "cumulative_revenue",
	"totalServers":      "total_servers",
	"computeCapacity":   "compute_capacity",
	"memoryCapacity":    "memory_capacity",
	"storageCapacity":   "storage_capacity",
	"gpuCapacity":       "gpu_capacity",
	"totalCapacity":     "(r.compute_capacity + r.memory_capacity + r.storage_capacity + r.gpu_capacity)",
}

// ListRuns returns ranked runs: metric DESC, submitted_at ASC, client_run_id ASC,
// id ASC, excluding zero-revenue runs; visibility "verified" (default for any
// value other than "all") additionally requires verification_status='verified'
// and a verified head row.
func (r *Repository) ListRuns(ctx context.Context, query leaderboard.LeaderboardQuery) ([]leaderboard.LeaderboardRunRecord, error) {
	col, ok := orderColumn[query.Metric]
	if !ok {
		return nil, fmt.Errorf("unsupported leaderboard metric: %s", query.Metric)
	}
	if col[0] != '(' {
		col = "r." + col
	}
	cols := ""
	for i, c := range splitCols(runCols) {
		if i > 0 {
			cols += ", "
		}
		cols += "r." + c
	}
	sql := `SELECT ` + cols + ` FROM leaderboard_runs r`
	if query.Visibility != "all" {
		sql += ` INNER JOIN verified_leaderboard_run_heads h ON h.player_id = r.player_id AND h.client_run_id = r.client_run_id`
	}
	sql += ` WHERE r.cumulative_revenue > 0`
	if query.Visibility != "all" {
		sql += ` AND r.verification_status = 'verified'`
	}
	sql += ` ORDER BY ` + col + ` DESC, r.submitted_at ASC, r.client_run_id ASC, r.id ASC LIMIT $1`

	rows, err := r.pool.Query(ctx, sql, query.Limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []leaderboard.LeaderboardRunRecord{}
	for rows.Next() {
		run, err := scanRun(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *run)
	}
	return out, rows.Err()
}

func splitCols(s string) []string {
	var out []string
	cur := ""
	for _, ch := range s {
		switch ch {
		case ',':
			out = append(out, cur)
			cur = ""
		case ' ', '\n', '\t':
		default:
			cur += string(ch)
		}
	}
	return append(out, cur)
}

func jsString(s *string) string {
	if s == nil {
		return "null"
	}
	return *s
}

func msTime(t time.Time) time.Time { return t.Truncate(time.Millisecond) }
