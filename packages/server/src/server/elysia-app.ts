import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import type { AppDependencies } from "../types.js";
import { createErrorBody, HttpError } from "./errors.js";

export type ServerElysiaApp = Elysia<any, any, any, any, any, any, any>;

export interface CreateElysiaServerAppOptions {
  context: AppDependencies;
  register?: (app: ServerElysiaApp, context: AppDependencies) => ServerElysiaApp;
}

export function createElysiaServerApp(options: CreateElysiaServerAppOptions): ServerElysiaApp {
  const { context, register } = options;

  const app = new Elysia()
    .use(
      cors({
        origin: [...context.config.corsAllowedOrigins],
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["content-type", "x-forwarded-for"],
      }),
    )
    .onError(({ code, error, request, set }) => {
      if (code === "NOT_FOUND") {
        set.status = 404;
        return createErrorBody(
          "NOT_FOUND",
          `No route matches ${request.method} ${new URL(request.url).pathname}`,
        );
      }

      if (code === "VALIDATION") {
        set.status = 400;
        return createErrorBody("INVALID_REQUEST", "Request validation failed.");
      }

      if (error instanceof HttpError) {
        set.status = error.status;
        return createErrorBody(error.code, error.message);
      }

      set.status = 500;
      return createErrorBody(
        "INTERNAL_SERVER_ERROR",
        error instanceof Error ? error.message : "Unknown server error",
      );
    }) as ServerElysiaApp;

  return register ? register(app, context) : app;
}
