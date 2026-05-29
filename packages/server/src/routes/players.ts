import {
  getClientRateLimitKey,
  type RateLimitRule,
} from "../rate-limit/fixed-window.js";
import type { ServerRoute } from "../server/app.js";
import { HttpError, jsonResponse } from "../server/app.js";
import type { ServerElysiaApp } from "../server/elysia-app.js";
import type { AppDependencies } from "../types.js";
import {
  checkUsernameAvailability,
  registerPlayerUsername,
} from "../players/service.js";

interface AvailabilityResponse {
  username: string;
  available: boolean;
}

interface RegistrationResponse {
  playerId: string;
  username: string;
}

export function createPlayerRoutes(): readonly ServerRoute[] {
  return [
    {
      method: "GET",
      pathname: "/players/availability",
      handler: async (request, { services }) => {
        const repository = services.players;

        if (!repository) {
          throw new HttpError(503, "PLAYERS_UNAVAILABLE", "Player registration is not configured.");
        }

        const url = new URL(request.url);
        const username = url.searchParams.get("username");

        if (username === null) {
          throw new HttpError(400, "INVALID_USERNAME", "username query parameter is required.");
        }

        const availability = await checkUsernameAvailability(repository, username);
        return jsonResponse(availability);
      },
    },
    {
      method: "POST",
      pathname: "/players",
      handler: async (request, { services, config }) => {
        const repository = services.players;

        if (!repository) {
          throw new HttpError(503, "PLAYERS_UNAVAILABLE", "Player registration is not configured.");
        }

        const rateLimiter = services.rateLimiter;

        if (rateLimiter) {
          enforceRateLimit(
            request,
            rateLimiter,
            config.rateLimits.playerRegistration,
            "player registrations",
          );
        }

        const body = await parseRegistrationRequest(request);
        const registration = await registerPlayerUsername(repository, body.username);

        return jsonResponse(registration, { status: 201 });
      },
    },
  ];
}

export function registerPlayerRoutes(
  app: ServerElysiaApp,
  { services, config }: AppDependencies,
): ServerElysiaApp {
  return app
    .get("/players/availability", async ({ request }) => {
      const repository = services.players;

      if (!repository) {
        throw new HttpError(503, "PLAYERS_UNAVAILABLE", "Player registration is not configured.");
      }

      const username = new URL(request.url).searchParams.get("username");

      if (username === null) {
        throw new HttpError(400, "INVALID_USERNAME", "username query parameter is required.");
      }

      return await checkUsernameAvailability(repository, username);
    })
    .post("/players", async ({ request, set }) => {
      const repository = services.players;

      if (!repository) {
        throw new HttpError(503, "PLAYERS_UNAVAILABLE", "Player registration is not configured.");
      }

      if (services.rateLimiter) {
        enforceRateLimit(
          request,
          services.rateLimiter,
          config.rateLimits.playerRegistration,
          "player registrations",
        );
      }

      const body = await parseRegistrationRequest(request);
      const registration = await registerPlayerUsername(repository, body.username);

      set.status = 201;
      return registration;
    });
}

async function parseRegistrationRequest(request: Request): Promise<{ username: string }> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  if (!payload || typeof payload !== "object") {
    throw new HttpError(400, "INVALID_USERNAME", "Request body must include a username string.");
  }

  const { username } = payload as { username?: unknown };

  if (typeof username !== "string") {
    throw new HttpError(400, "INVALID_USERNAME", "Request body must include a username string.");
  }

  return { username };
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
