import { test } from "bun:test";
import { loadServerConfig, type ServerConfig } from "../config.js";
import { createApp } from "../index.js";
import type { ServerElysiaApp } from "../server/elysia-app.js";
import type { AppDependencies, ServerServices } from "../types.js";

export interface CreateTestAppOptions {
  config?: Partial<ServerConfig>;
  services?: ServerServices;
}

export interface ApiResponse<TBody = unknown> {
  response: Response;
  bodyText: string;
  json: TBody | null;
}

export function createTestDependencies(
  options: CreateTestAppOptions = {},
): AppDependencies {
  const baseConfig = loadServerConfig({
    NODE_ENV: "test",
    PORT: "4010",
    HOST: "127.0.0.1",
    CORS_ALLOWED_ORIGINS: "http://localhost:5173,http://localhost:4173",
    SERVER_VERSION: "9.9.9-test",
  });

  return {
    config: {
      ...baseConfig,
      ...options.config,
    },
    services: options.services ?? {},
  };
}

export function createTestApp(options: CreateTestAppOptions = {}) {
  const dependencies = createTestDependencies(options);

  return {
    app: createApp(dependencies),
    dependencies,
  };
}

/**
 * Black-box mode: when SERVER_BASE_URL is set (e.g. http://127.0.0.1:3000), apiRequest sends a real
 * fetch() to that running server instead of calling the in-process app. The same HTTP contract tests
 * then validate an external implementation (packages/server-go). Run via `npm run test:blackbox`.
 *
 * The external server must be started in-memory (no DATABASE_URL) with NODE_ENV=test,
 * SERVER_VERSION=9.9.9-test, CORS_ALLOWED_ORIGINS set, and the three *_RATE_LIMIT_MAX_REQUESTS raised,
 * because healthz expects databaseConfigured=false and the suite issues far more than 10 requests/second.
 *
 * Tests skipped in blackbox mode via `inProcessTest` (they cannot run against a separate process):
 * - Injected fakes or rate limiters (services.* / config overrides, which the external server ignores):
 *   http-contract "global backend throttling...", "rate-limited requests preserve...";
 *   players "POST /players surfaces persistence failures...", "POST /players rate-limits...";
 *   leaderboard "POST /leaderboard/runs surfaces repository failures...", "...rate-limits repeated submissions...",
 *   "...allows one submission per second for the same client IP".
 * - Seeded InMemory repositories (players.createPlayer / leaderboard.commitVerifiedRun called directly):
 *   http-contract "GET /leaderboard preserves query-validation and response-envelope behavior";
 *   leaderboard "GET /leaderboard returns ranked verified entries...", "...applies deterministic tie-breaking...",
 *   "GET /leaderboard can return all or only verified runs".
 * - Config-only healthz variants (they build an app with a development PGlite-file or production Bun SQL config):
 *   health "GET /healthz reports file-backed PGlite metadata...", "GET /healthz reports Bun SQL metadata...".
 * - Not in-process at all, but currently marked inProcessTest and skipped in blackbox mode with no recorded reason:
 *   http-contract "GET /version preserves its status code and JSON payload shape";
 *   health "GET /version returns server and game-logic versions". They only need HTTP and should likely be `test`.
 *
 * Not run in blackbox mode at all (not HTTP): index.test.ts (config parsing), drizzle-persistence.test.ts
 * (in-process PGlite), server/dependencies.test.ts, and the pure contract/type-only assertions that always run.
 *
 * Also adapted for blackbox mode (not skipped): fixed usernames get a per-test suffix via uniqueSuffix(), and
 * healthz runtime/framework/databaseMode/databaseProvider values are relaxed via expectedHealthBody(), because
 * test-utils/contracts.ts declares those implementation details free to change.
 */
export function getBlackboxBaseUrl(): string | undefined {
  const value = process.env.SERVER_BASE_URL?.trim();

  return value ? value.replace(/\/+$/, "") : undefined;
}

export function isBlackboxMode(): boolean {
  return getBlackboxBaseUrl() !== undefined;
}

/** `test` normally; `test.skip` in blackbox mode for tests that need in-process repositories or fakes. */
export const inProcessTest = isBlackboxMode() ? test.skip : test;

/**
 * Blackbox-only: a random suffix (e.g. " kqzvb") appended to fixed usernames so tests do not collide on a
 * shared external server, where players persist across tests. Empty in-process, so inputs are unchanged.
 * Keep literal base names short: usernames are capped at 24 characters.
 */
export function uniqueSuffix(): string {
  if (!isBlackboxMode()) {
    return "";
  }

  let suffix = " ";

  for (let index = 0; index < 5; index += 1) {
    suffix += String.fromCharCode(97 + Math.floor(Math.random() * 26));
  }

  return suffix;
}

const IMPLEMENTATION_HEALTH_FIELDS = ["runtime", "framework", "databaseMode", "databaseProvider"] as const;

/**
 * Blackbox-only: /healthz runtime/framework/database *values* are implementation details (see
 * test-utils/contracts.ts), so copy them from the live response and keep every other field exact.
 * Field presence is still enforced because deepEqual compares key sets. In-process, `expected` is returned as-is.
 */
export function expectedHealthBody<TBody extends Record<string, unknown>>(
  expected: TBody,
  actual: unknown,
): TBody {
  if (!isBlackboxMode() || typeof actual !== "object" || actual === null) {
    return expected;
  }

  const live = actual as Record<string, unknown>;
  const relaxed: Record<string, unknown> = { ...expected };

  for (const field of IMPLEMENTATION_HEALTH_FIELDS) {
    relaxed[field] = live[field];
  }

  return relaxed as TBody;
}

export async function apiRequest<TBody = unknown>(
  app: ServerElysiaApp,
  path: string,
  init: RequestInit = {},
): Promise<ApiResponse<TBody>> {
  const blackboxBaseUrl = getBlackboxBaseUrl();
  const response = blackboxBaseUrl
    ? await fetch(`${blackboxBaseUrl}${path}`, init)
    : await app.fetch(new Request(new URL(path, "http://localhost").toString(), init));
  const bodyText = await response.text();
  const json = bodyText === "" ? null : (JSON.parse(bodyText) as TBody);

  return {
    response,
    bodyText,
    json,
  };
}
