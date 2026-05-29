import {
  bigint,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const players = pgTable(
  "players",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    normalizedUsername: text("normalized_username").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [uniqueIndex("players_normalized_username_key").on(table.normalizedUsername)],
);

export const leaderboardRuns = pgTable(
  "leaderboard_runs",
  {
    id: text("id").primaryKey(),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    clientRunId: text("client_run_id").notNull(),
    money: bigint("money", { mode: "number" }).notNull(),
    cumulativeRevenue: bigint("cumulative_revenue", { mode: "number" }).notNull(),
    totalServers: integer("total_servers").notNull(),
    computeCapacity: bigint("compute_capacity", { mode: "number" }).notNull(),
    memoryCapacity: bigint("memory_capacity", { mode: "number" }).notNull(),
    storageCapacity: bigint("storage_capacity", { mode: "number" }).notNull(),
    gpuCapacity: bigint("gpu_capacity", { mode: "number" }).notNull(),
    gameMonth: integer("game_month").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("leaderboard_runs_player_client_run_key").on(table.playerId, table.clientRunId),
    index("leaderboard_runs_player_id_submitted_at_idx").on(table.playerId, table.submittedAt),
    index("leaderboard_runs_money_rank_idx").on(table.money, table.submittedAt, table.id),
    index("leaderboard_runs_revenue_rank_idx").on(
      table.cumulativeRevenue,
      table.submittedAt,
      table.id,
    ),
    index("leaderboard_runs_total_servers_rank_idx").on(
      table.totalServers,
      table.submittedAt,
      table.id,
    ),
    index("leaderboard_runs_compute_capacity_rank_idx").on(
      table.computeCapacity,
      table.submittedAt,
      table.id,
    ),
    index("leaderboard_runs_memory_capacity_rank_idx").on(
      table.memoryCapacity,
      table.submittedAt,
      table.id,
    ),
    index("leaderboard_runs_storage_capacity_rank_idx").on(
      table.storageCapacity,
      table.submittedAt,
      table.id,
    ),
    index("leaderboard_runs_gpu_capacity_rank_idx").on(
      table.gpuCapacity,
      table.submittedAt,
      table.id,
    ),
  ],
);
