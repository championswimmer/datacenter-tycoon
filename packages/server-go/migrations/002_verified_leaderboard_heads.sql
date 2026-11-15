ALTER TABLE leaderboard_runs
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified';

UPDATE leaderboard_runs
SET verification_status = 'unverified'
WHERE verification_status IS DISTINCT FROM 'unverified';

CREATE TABLE IF NOT EXISTS verified_leaderboard_run_heads (
  player_id TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  client_run_id TEXT NOT NULL,
  protocol_version TEXT NOT NULL,
  ruleset_id TEXT NOT NULL,
  genesis_seed BIGINT NOT NULL,
  genesis_difficulty TEXT NOT NULL,
  root_hash TEXT NOT NULL,
  head_hash TEXT NOT NULL,
  state_hash TEXT NOT NULL,
  previous_head_hash TEXT,
  last_request_hash TEXT NOT NULL,
  game_state_json TEXT NOT NULL,
  game_month INTEGER NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT verified_leaderboard_run_heads_pkey PRIMARY KEY (player_id, client_run_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS verified_leaderboard_run_heads_head_hash_key
  ON verified_leaderboard_run_heads (head_hash);

CREATE INDEX IF NOT EXISTS verified_leaderboard_run_heads_player_updated_at_idx
  ON verified_leaderboard_run_heads (player_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS leaderboard_runs_verification_status_money_rank_idx
  ON leaderboard_runs (verification_status, money DESC, submitted_at ASC, id ASC);

CREATE INDEX IF NOT EXISTS leaderboard_runs_verification_status_revenue_rank_idx
  ON leaderboard_runs (verification_status, cumulative_revenue DESC, submitted_at ASC, id ASC);

CREATE INDEX IF NOT EXISTS leaderboard_runs_verification_status_total_servers_rank_idx
  ON leaderboard_runs (verification_status, total_servers DESC, submitted_at ASC, id ASC);

CREATE INDEX IF NOT EXISTS leaderboard_runs_verification_status_compute_capacity_rank_idx
  ON leaderboard_runs (verification_status, compute_capacity DESC, submitted_at ASC, id ASC);

CREATE INDEX IF NOT EXISTS leaderboard_runs_verification_status_memory_capacity_rank_idx
  ON leaderboard_runs (verification_status, memory_capacity DESC, submitted_at ASC, id ASC);

CREATE INDEX IF NOT EXISTS leaderboard_runs_verification_status_storage_capacity_rank_idx
  ON leaderboard_runs (verification_status, storage_capacity DESC, submitted_at ASC, id ASC);

CREATE INDEX IF NOT EXISTS leaderboard_runs_verification_status_gpu_capacity_rank_idx
  ON leaderboard_runs (verification_status, gpu_capacity DESC, submitted_at ASC, id ASC);
