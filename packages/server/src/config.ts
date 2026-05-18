import { VERSION as gameLogicVersion } from "@datacenter-tycoon/game-logic";

export type ServerEnvironment = "development" | "test" | "production";

export interface ServerConfig {
  environment: ServerEnvironment;
  host: string;
  port: number;
  corsAllowedOrigins: readonly string[];
  databaseUrl?: string;
  serverVersion: string;
  gameLogicVersion: string;
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
  const databaseUrl = env.DATABASE_URL?.trim() || undefined;
  const serverVersion = env.SERVER_VERSION?.trim() || env.npm_package_version?.trim() || "0.1.0";

  return {
    environment,
    host,
    port,
    corsAllowedOrigins,
    databaseUrl,
    serverVersion,
    gameLogicVersion,
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
