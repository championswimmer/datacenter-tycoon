CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  normalized_username TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS players_normalized_username_key
  ON players (normalized_username);

CREATE TABLE IF NOT EXISTS leaderboard_runs (
  id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  client_run_id TEXT NOT NULL,
  money BIGINT NOT NULL,
  cumulative_revenue BIGINT NOT NULL,
  total_servers INTEGER NOT NULL,
  compute_capacity BIGINT NOT NULL,
  memory_capacity BIGINT NOT NULL,
  storage_capacity BIGINT NOT NULL,
  gpu_capacity BIGINT NOT NULL,
  game_month INTEGER NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT leaderboard_runs_player_client_run_key UNIQUE (player_id, client_run_id)
);

CREATE INDEX IF NOT EXISTS leaderboard_runs_player_id_submitted_at_idx
  ON leaderboard_runs (player_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS leaderboard_runs_money_rank_idx
  ON leaderboard_runs (money DESC, submitted_at ASC, id ASC);

CREATE INDEX IF NOT EXISTS leaderboard_runs_revenue_rank_idx
  ON leaderboard_runs (cumulative_revenue DESC, submitted_at ASC, id ASC);

CREATE INDEX IF NOT EXISTS leaderboard_runs_total_servers_rank_idx
  ON leaderboard_runs (total_servers DESC, submitted_at ASC, id ASC);

CREATE INDEX IF NOT EXISTS leaderboard_runs_compute_capacity_rank_idx
  ON leaderboard_runs (compute_capacity DESC, submitted_at ASC, id ASC);

CREATE INDEX IF NOT EXISTS leaderboard_runs_memory_capacity_rank_idx
  ON leaderboard_runs (memory_capacity DESC, submitted_at ASC, id ASC);

CREATE INDEX IF NOT EXISTS leaderboard_runs_storage_capacity_rank_idx
  ON leaderboard_runs (storage_capacity DESC, submitted_at ASC, id ASC);

CREATE INDEX IF NOT EXISTS leaderboard_runs_gpu_capacity_rank_idx
  ON leaderboard_runs (gpu_capacity DESC, submitted_at ASC, id ASC);
