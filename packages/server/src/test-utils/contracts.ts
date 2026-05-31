export interface FrozenEndpointContract {
  readonly method: string;
  readonly path: string;
  readonly successStatus: number;
  readonly errorCodes: readonly string[];
}

export const frozenEndpointContracts = {
  healthz: {
    method: "GET",
    path: "/healthz",
    successStatus: 200,
    errorCodes: ["RATE_LIMITED"],
  },
  version: {
    method: "GET",
    path: "/version",
    successStatus: 200,
    errorCodes: ["RATE_LIMITED"],
  },
  playerAvailability: {
    method: "GET",
    path: "/players/availability",
    successStatus: 200,
    errorCodes: ["INVALID_USERNAME", "PLAYERS_UNAVAILABLE", "RATE_LIMITED"],
  },
  registerPlayer: {
    method: "POST",
    path: "/players",
    successStatus: 201,
    errorCodes: [
      "INVALID_JSON",
      "INVALID_USERNAME",
      "USERNAME_UNAVAILABLE",
      "RATE_LIMITED",
      "PLAYERS_UNAVAILABLE",
      "INTERNAL_SERVER_ERROR",
    ],
  },
  leaderboard: {
    method: "GET",
    path: "/leaderboard",
    successStatus: 200,
    errorCodes: ["INVALID_LEADERBOARD_QUERY", "LEADERBOARD_UNAVAILABLE", "RATE_LIMITED"],
  },
  submitLeaderboardRun: {
    method: "POST",
    path: "/leaderboard/runs",
    successStatus: 201,
    errorCodes: [
      "INVALID_JSON",
      "INVALID_LEADERBOARD_SUBMISSION",
      "PLAYER_NOT_FOUND",
      "NON_MONOTONIC_RUN_UPDATE",
      "RATE_LIMITED",
      "LEADERBOARD_UNAVAILABLE",
      "INTERNAL_SERVER_ERROR",
    ],
  },
} satisfies Record<string, FrozenEndpointContract>;

export const stableTransportContractDetails = [
  "HTTP methods and paths for /healthz, /version, /players/availability, /players, /leaderboard, and /leaderboard/runs.",
  "Success and error status codes plus stable JSON envelope shapes for the public endpoints, including runtime/framework/database metadata on /healthz.",
  "Stable machine-readable error codes such as INVALID_JSON, INVALID_USERNAME, USERNAME_UNAVAILABLE, PLAYER_NOT_FOUND, INVALID_LEADERBOARD_QUERY, INVALID_LEADERBOARD_SUBMISSION, NON_MONOTONIC_RUN_UPDATE, RATE_LIMITED, and INTERNAL_SERVER_ERROR across both global and route-level throttles.",
  "JSON content type responses plus the current Elysia CORS metadata behavior (no echoed origin without an Origin request header, but access-control-allow-credentials remains present) / Retry-After headers.",
  "Rate-limited requests returning status 429 with a RATE_LIMITED error body whose message embeds the retry-after seconds, whether triggered by the backend-global throttle or a route-level throttle.",
] as const;

export const internalImplementationDetailsFreeToChange = [
  "The transport implementation (custom fetch router and node:http adapter today, Elysia + Bun runtime after migration).",
  "The persistence implementation (raw pg SQL today, Drizzle repositories and migrations after migration).",
  "Dependency-injection wiring, repository classes, and how services are instantiated at startup.",
  "How request validation is implemented internally, as long as the external error/status contract stays stable.",
  "Operational logging and startup sequencing, unless a response contract test explicitly covers them.",
] as const;
