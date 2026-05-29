import type { AppDependencies } from "../types.js";
import { createErrorBody, HttpError } from "./errors.js";

export { HttpError } from "./errors.js";

export interface ServerRoute {
  method: string;
  pathname: string;
  handler: (
    request: Request,
    dependencies: AppDependencies,
  ) => Promise<Response> | Response;
}

export interface ServerApp {
  fetch: (request: Request) => Promise<Response>;
}

export interface CreateServerAppOptions {
  context: AppDependencies;
  routes: readonly ServerRoute[];
  onError?: (error: unknown) => Promise<Response> | Response;
}

export function createServerApp(options: CreateServerAppOptions): ServerApp {
  const { context, routes, onError = defaultErrorHandler } = options;

  return {
    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);
      const route = routes.find(
        (candidate) =>
          candidate.method === request.method && candidate.pathname === url.pathname,
      );

      if (!route) {
        return jsonResponse(
          {
            error: {
              code: "NOT_FOUND",
              message: `No route matches ${request.method} ${url.pathname}`,
            },
          },
          { status: 404 },
        );
      }

      try {
        return await route.handler(request, context);
      } catch (error) {
        return await onError(error);
      }
    },
  };
}

export function jsonResponse(
  body: unknown,
  init: ResponseInit = {},
): Response {
  const headers = new Headers(init.headers);

  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json; charset=utf-8");
  }

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

function defaultErrorHandler(error: unknown): Response {
  if (error instanceof HttpError) {
    return jsonResponse(createErrorBody(error.code, error.message), {
      status: error.status,
    });
  }

  const message = error instanceof Error ? error.message : "Unknown server error";

  return jsonResponse(createErrorBody("INTERNAL_SERVER_ERROR", message), {
    status: 500,
  });
}
