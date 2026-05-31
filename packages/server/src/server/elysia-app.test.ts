import assert from "node:assert/strict";
import { test } from "bun:test";
import { t } from "elysia";
import { loadServerConfig } from "../config.js";
import type { AppDependencies } from "../types.js";
import { createElysiaServerApp } from "./elysia-app.js";
import { HttpError } from "./errors.js";

function createDependencies(): AppDependencies {
  return {
    config: loadServerConfig({
      NODE_ENV: "test",
      PORT: "3000",
      HOST: "127.0.0.1",
      CORS_ALLOWED_ORIGINS: "http://localhost:5173,http://localhost:4173",
      SERVER_VERSION: "9.9.9-test",
    }),
    services: {},
  };
}

function assertJson(response: Response) {
  assert.match(response.headers.get("content-type") ?? "", /^application\/json(?:;\s?charset=utf-8)?$/i);
}

test("createElysiaServerApp adds CORS for configured origins", async () => {
  const app = createElysiaServerApp({
    context: createDependencies(),
    register: (elysia) => elysia.get("/probe", () => ({ ok: true })),
  });

  const response = await app.handle(
    new Request("http://localhost/probe", {
      headers: {
        origin: "http://localhost:5173",
      },
    }),
  );

  assert.equal(response.status, 200);
  assertJson(response);
  assert.equal(response.headers.get("access-control-allow-origin"), "http://localhost:5173");
});

test("createElysiaServerApp allows the first-party production web origin when configured origins omit it", async () => {
  const app = createElysiaServerApp({
    context: {
      ...createDependencies(),
      config: loadServerConfig({
        NODE_ENV: "production",
        PORT: "3000",
        HOST: "127.0.0.1",
        CORS_ALLOWED_ORIGINS: "https://dctycoon-api-production.up.railway.app",
        DATABASE_URL: "postgres://127.0.0.1:5432/datacenter_tycoon",
        SERVER_VERSION: "9.9.9-test",
      }),
    },
    register: (elysia) => elysia.get("/probe", () => ({ ok: true })),
  });

  const response = await app.handle(
    new Request("http://localhost/probe", {
      headers: {
        origin: "https://dctycoon.arnav.tech",
      },
    }),
  );

  assert.equal(response.status, 200);
  assertJson(response);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://dctycoon.arnav.tech");
});

test("createElysiaServerApp maps NOT_FOUND responses into the existing JSON error envelope", async () => {
  const app = createElysiaServerApp({
    context: createDependencies(),
  });

  const response = await app.handle(new Request("http://localhost/missing"));
  const json = await response.json();

  assert.equal(response.status, 404);
  assertJson(response);
  assert.deepEqual(json, {
    error: {
      code: "NOT_FOUND",
      message: "No route matches GET /missing",
    },
  });
});

test("createElysiaServerApp maps HttpError instances into the shared JSON error envelope", async () => {
  const app = createElysiaServerApp({
    context: createDependencies(),
    register: (elysia) =>
      elysia.get("/teapot", () => {
        throw new HttpError(418, "BREW_FAILURE", "Short and stout.");
      }),
  });

  const response = await app.handle(new Request("http://localhost/teapot"));
  const json = await response.json();

  assert.equal(response.status, 418);
  assertJson(response);
  assert.deepEqual(json, {
    error: {
      code: "BREW_FAILURE",
      message: "Short and stout.",
    },
  });
});

test("createElysiaServerApp normalizes Elysia validation failures into the shared JSON error envelope", async () => {
  const app = createElysiaServerApp({
    context: createDependencies(),
    register: (elysia) =>
      elysia.post(
        "/validated",
        ({ body }) => body,
        {
          body: t.Object({
            username: t.String(),
          }),
        },
      ),
  });

  const response = await app.handle(
    new Request("http://localhost/validated", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ username: 123 }),
    }),
  );
  const json = await response.json();

  assert.equal(response.status, 400);
  assertJson(response);
  assert.deepEqual(json, {
    error: {
      code: "INVALID_REQUEST",
      message: "Request validation failed.",
    },
  });
});

test("createElysiaServerApp normalizes unexpected errors into INTERNAL_SERVER_ERROR", async () => {
  const app = createElysiaServerApp({
    context: createDependencies(),
    register: (elysia) =>
      elysia.get("/explode", () => {
        throw new Error("boom");
      }),
  });

  const response = await app.handle(new Request("http://localhost/explode"));
  const json = await response.json();

  assert.equal(response.status, 500);
  assertJson(response);
  assert.deepEqual(json, {
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "boom",
    },
  });
});
