import { relations } from "drizzle-orm";
import { leaderboardRuns, players, verifiedLeaderboardRunHeads } from "./schema.js";

export const playersRelations = relations(players, ({ many }) => ({
  leaderboardRuns: many(leaderboardRuns),
  verifiedLeaderboardRunHeads: many(verifiedLeaderboardRunHeads),
}));

export const leaderboardRunsRelations = relations(leaderboardRuns, ({ one }) => ({
  player: one(players, {
    fields: [leaderboardRuns.playerId],
    references: [players.id],
  }),
  verifiedHead: one(verifiedLeaderboardRunHeads, {
    fields: [leaderboardRuns.playerId, leaderboardRuns.clientRunId],
    references: [verifiedLeaderboardRunHeads.playerId, verifiedLeaderboardRunHeads.clientRunId],
  }),
}));

export const verifiedLeaderboardRunHeadsRelations = relations(
  verifiedLeaderboardRunHeads,
  ({ one }) => ({
    player: one(players, {
      fields: [verifiedLeaderboardRunHeads.playerId],
      references: [players.id],
    }),
    leaderboardRun: one(leaderboardRuns, {
      fields: [verifiedLeaderboardRunHeads.playerId, verifiedLeaderboardRunHeads.clientRunId],
      references: [leaderboardRuns.playerId, leaderboardRuns.clientRunId],
    }),
  }),
);
