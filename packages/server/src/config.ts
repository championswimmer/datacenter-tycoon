import { VERSION as gameLogicVersion } from "@datacenter-tycoon/game-logic";
import type { RateLimitRule } from "./rate-limit/fixed-window.js";

export type ServerEnvironment = "development" | "test" | "production";
export type ServerDatabaseMode = "postgres" | "pglite";
export type ServerDatabaseProvider = "bun-sql" | "pglite-file" | "pglite-memory";

export interface ServerRateLimitConfig {
  playerRegistration: RateLimitRule;
  leaderboardSubmission: RateLimitRule;
}

export interface ServerDatabaseConfig {
  mode: ServerDatabaseMode;
  connectionString?: string;
  pgliteDataDir?: string;
}

export interface ServerConfig {
  environment: ServerEnvironment;
  host: string;
  port: number;
  corsAllowedOrigins: readonly string[];
  database: ServerDatabaseConfig;
  databaseUrl?: string;
  rateLimits: ServerRateLimitConfig;
  serverVersion: string;
  gameLogicVersion: string;
}

export interface ServerDatabaseRuntimeInfo {
  mode: ServerDatabaseMode;
  provider: ServerDatabaseProvider;
  configured: boolean;
}

export class ConfigError extends Error {
  readonly code = "CONFIG_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function loadServerConfig(
  env: Record<string, string | undefined> = process.env,
): ServerConfig {
  const environment = parseEnvironment(env.NODE_ENV);
  const port = parsePort(env.PORT);
  const host = env.HOST?.trim() || "0.0.0.0";
  const corsAllowedOrigins = parseCorsAllowedOrigins(environment, env.CORS_ALLOWED_ORIGINS);
  const database = parseDatabaseConfig(environment, env);
  const rateLimits = {
    playerRegistration: {
      windowMs: parsePositiveInteger(
        env.PLAYER_REGISTRATION_RATE_LIMIT_WINDOW_MS,
        60_000,
        "PLAYER_REGISTRATION_RATE_LIMIT_WINDOW_MS",
      ),
      maxRequests: parsePositiveInteger(
        env.PLAYER_REGISTRATION_RATE_LIMIT_MAX_REQUESTS,
        10,
        "PLAYER_REGISTRATION_RATE_LIMIT_MAX_REQUESTS",
      ),
    },
    leaderboardSubmission: {
      windowMs: parsePositiveInteger(
        env.LEADERBOARD_SUBMISSION_RATE_LIMIT_WINDOW_MS,
        60_000,
        "LEADERBOARD_SUBMISSION_RATE_LIMIT_WINDOW_MS",
      ),
      maxRequests: parsePositiveInteger(
        env.LEADERBOARD_SUBMISSION_RATE_LIMIT_MAX_REQUESTS,
        120,
        "LEADERBOARD_SUBMISSION_RATE_LIMIT_MAX_REQUESTS",
      ),
    },
  } satisfies ServerRateLimitConfig;
  const serverVersion = env.SERVER_VERSION?.trim() || env.npm_package_version?.trim() || "0.1.0";

  return {
    environment,
    host,
    port,
    corsAllowedOrigins,
    database,
    databaseUrl: database.mode === "postgres" ? database.connectionString : undefined,
    rateLimits,
    serverVersion,
    gameLogicVersion,
  };
}

export function getServerDatabaseRuntimeInfo(
  config: Pick<ServerConfig, "database">,
): ServerDatabaseRuntimeInfo {
  if (config.database.mode === "postgres") {
    return {
      mode: "postgres",
      provider: "bun-sql",
      configured: config.database.connectionString !== undefined,
    };
  }

  return {
    mode: "pglite",
    provider: config.database.pgliteDataDir ? "pglite-file" : "pglite-memory",
    configured: config.database.pgliteDataDir !== undefined,
  };
}

function parseEnvironment(value: string | undefined): ServerEnvironment {
  switch (value) {
    case undefined:
    case "development":
      return "development";
    case "test":
    case "production":
      return value;
    default:
      throw new ConfigError(
        `NODE_ENV must be one of development, test, or production. Received: ${value}`,
      );
  }
}

function parsePort(value: string | undefined): number {
  if (value === undefined || value.trim() === "") {
    return 3000;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new ConfigError(`PORT must be an integer between 1 and 65535. Received: ${value}`);
  }

  return parsed;
}

function parseCorsAllowedOrigins(
  environment: ServerEnvironment,
  rawOrigins: string | undefined,
): readonly string[] {
  const origins = rawOrigins
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (origins && origins.length > 0) {
    return [...new Set(origins)];
  }

  if (environment === "production") {
    throw new ConfigError("CORS_ALLOWED_ORIGINS is required in production.");
  }

  return ["http://localhost:5173"];
}

function parseDatabaseConfig(
  environment: ServerEnvironment,
  env: Record<string, string | undefined>,
): ServerDatabaseConfig {
  const databaseUrl = env.DATABASE_URL?.trim();

  if (databaseUrl) {
    return {
      mode: "postgres",
      connectionString: databaseUrl,
    };
  }

  if (environment === "production") {
    throw new ConfigError("DATABASE_URL is required in production.");
  }

  const pgliteDataDir = env.PGLITE_DATA_DIR?.trim();

  if (environment === "development") {
    return {
      mode: "pglite",
      pgliteDataDir: pgliteDataDir || ".data/pglite",
    };
  }

  return {
    mode: "pglite",
    pgliteDataDir: pgliteDataDir || undefined,
  };
}

function parsePositiveInteger(
  value: string | undefined,
  defaultValue: number,
  fieldName: string,
): number {
  if (value === undefined || value.trim() === "") {
    return defaultValue;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ConfigError(`${fieldName} must be a positive integer. Received: ${value}`);
  }

  return parsed;
}
