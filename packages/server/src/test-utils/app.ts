import { loadServerConfig, type ServerConfig } from "../config.js";
import { createApp } from "../index.js";
import type { ServerApp } from "../server/app.js";
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

export async function apiRequest<TBody = unknown>(
  app: ServerApp | ServerElysiaApp,
  path: string,
  init: RequestInit = {},
): Promise<ApiResponse<TBody>> {
  const url = new URL(path, "http://localhost");
  const request = new Request(url, init);
  const response = "handle" in app ? await app.handle(request) : await app.fetch(request);
  const bodyText = await response.text();
  const json = bodyText === "" ? null : (JSON.parse(bodyText) as TBody);

  return {
    response,
    bodyText,
    json,
  };
}
