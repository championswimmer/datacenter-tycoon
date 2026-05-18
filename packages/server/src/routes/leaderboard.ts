import { submitLeaderboardRun } from "../leaderboard/service.js";
import type { LeaderboardRunRecord } from "../leaderboard/types.js";
import type { ServerRoute } from "../server/app.js";
import { HttpError, jsonResponse } from "../server/app.js";

export function createLeaderboardRoutes(): readonly ServerRoute[] {
  return [
    {
      method: "POST",
      pathname: "/leaderboard/runs",
      handler: async (request, { services }) => {
        const playersRepository = services.players;
        const leaderboardRepository = services.leaderboard;

        if (!playersRepository || !leaderboardRepository) {
          throw new HttpError(
            503,
            "LEADERBOARD_UNAVAILABLE",
            "Online leaderboard submission is not configured.",
          );
        }

        const payload = await parseJsonBody(request);
        const result = await submitLeaderboardRun(
          playersRepository,
          leaderboardRepository,
          payload,
        );

        return jsonResponse(
          {
            created: result.created,
            run: serializeLeaderboardRun(result.run),
          },
          { status: result.created ? 201 : 200 },
        );
      },
    },
  ];
}

async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
}

function serializeLeaderboardRun(run: LeaderboardRunRecord) {
  return {
    runId: run.runId,
    playerId: run.playerId,
    clientRunId: run.clientRunId,
    metrics: run.metrics,
    gameMonth: run.gameMonth,
    submittedAt: run.submittedAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  };
}
