import { relations } from "drizzle-orm";
import { leaderboardRuns, players } from "./schema.js";

export const playersRelations = relations(players, ({ many }) => ({
  leaderboardRuns: many(leaderboardRuns),
}));

export const leaderboardRunsRelations = relations(leaderboardRuns, ({ one }) => ({
  player: one(players, {
    fields: [leaderboardRuns.playerId],
    references: [players.id],
  }),
}));
