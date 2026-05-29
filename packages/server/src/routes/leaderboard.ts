import { queryLeaderboardEntries, submitLeaderboardRun } from "../leaderboard/service.js";
import type { LeaderboardEntry } from "../leaderboard/queries.js";
import type { LeaderboardRunRecord } from "../leaderboard/types.js";
import {
  getClientRateLimitKey,
  type RateLimitRule,
} from "../rate-limit/fixed-window.js";
import { HttpError } from "../server/errors.js";
import type { ServerElysiaApp } from "../server/elysia-app.js";
import type { AppDependencies } from "../types.js";

export function registerLeaderboardRoutes(
  app: ServerElysiaApp,
  { services, config }: AppDependencies,
): ServerElysiaApp {
  return app
    .get("/leaderboard", async ({ request }) => {
      const playersRepository = services.players;
      const leaderboardRepository = services.leaderboard;

      if (!playersRepository || !leaderboardRepository) {
        throw new HttpError(
          503,
          "LEADERBOARD_UNAVAILABLE",
          "Online leaderboard submission is not configured.",
        );
      }

      const { query, entries } = await queryLeaderboardEntries(
        playersRepository,
        leaderboardRepository,
        new URL(request.url).searchParams,
      );

      return {
        metric: query.metric,
        period: query.period,
        limit: query.limit,
        entries: entries.map((entry) => serializeLeaderboardEntry(entry)),
      };
    })
    .post("/leaderboard/runs", async ({ request, set }) => {
      const playersRepository = services.players;
      const leaderboardRepository = services.leaderboard;

      if (!playersRepository || !leaderboardRepository) {
        throw new HttpError(
          503,
          "LEADERBOARD_UNAVAILABLE",
          "Online leaderboard submission is not configured.",
        );
      }

      if (services.rateLimiter) {
        enforceRateLimit(
          request,
          services.rateLimiter,
          config.rateLimits.leaderboardSubmission,
          "leaderboard submissions",
        );
      }

      const payload = await parseJsonBody(request);
      const result = await submitLeaderboardRun(
        playersRepository,
        leaderboardRepository,
        payload,
      );

      set.status = result.created ? 201 : 200;
      return {
        created: result.created,
        run: serializeLeaderboardRun(result.run),
      };
    });
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

function serializeLeaderboardEntry(entry: LeaderboardEntry) {
  return {
    rank: entry.rank,
    playerId: entry.playerId,
    username: entry.username,
    metric: entry.metric,
    value: entry.value,
    submittedAt: entry.submittedAt.toISOString(),
    gameMonth: entry.gameMonth,
    metrics: entry.metrics,
  };
}

function enforceRateLimit(
  request: Request,
  rateLimiter: { consume: (scope: string, key: string, rule: RateLimitRule) => { allowed: boolean; retryAfterSeconds: number } },
  rule: RateLimitRule,
  resourceName: string,
): void {
  const decision = rateLimiter.consume(resourceName, getClientRateLimitKey(request), rule);

  if (!decision.allowed) {
    throw new HttpError(
      429,
      "RATE_LIMITED",
      `Too many ${resourceName}. Retry after ${decision.retryAfterSeconds} seconds.`,
    );
  }
}
