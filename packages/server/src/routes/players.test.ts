import assert from "node:assert/strict";
import { test } from "bun:test";
import { apiRequest, createTestApp } from "../test-utils/app.js";
import type { PlayersRepository, RegisterPlayerInput } from "../players/repository.js";
import { UsernameUnavailableError } from "../players/repository.js";
import type { RateLimiter, RateLimitRule } from "../rate-limit/fixed-window.js";

test("GET /players/availability reports a username as available", async () => {
  const { app } = createTestApp();
  const { response, json } = await apiRequest<{
    username: string;
    available: boolean;
  }>(app, "/players/availability?username=Acme%20Cloud");

  assert.equal(response.status, 200);
  assert.deepEqual(json, {
    username: "Acme Cloud",
    available: true,
  });
});

test("GET /players/availability reports duplicate normalized usernames as unavailable", async () => {
  const { app } = createTestApp();

  await apiRequest(app, "/players", {
    method: "POST",
    body: JSON.stringify({ username: "Acme Cloud" }),
    headers: { "content-type": "application/json" },
  });

  const { response, json } = await apiRequest<{
    username: string;
    available: boolean;
  }>(app, "/players/availability?username=  acme   cloud  ");

  assert.equal(response.status, 200);
  assert.deepEqual(json, {
    username: "acme cloud",
    available: false,
  });
});

test("POST /players registers a username and returns the new player identity", async () => {
  const { app } = createTestApp();
  const { response, json } = await apiRequest<{
    playerId: string;
    username: string;
  }>(app, "/players", {
    method: "POST",
    body: JSON.stringify({ username: "  Acme Cloud  " }),
    headers: { "content-type": "application/json" },
  });

  assert.equal(response.status, 201);
  assert.equal(json?.username, "Acme Cloud");
  assert.match(
    json?.playerId ?? "",
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
});

test("POST /players rejects duplicate usernames after case and whitespace normalization", async () => {
  const { app } = createTestApp();

  await apiRequest(app, "/players", {
    method: "POST",
    body: JSON.stringify({ username: "John Doe123" }),
    headers: { "content-type": "application/json" },
  });

  const { response, json } = await apiRequest<{
    error: { code: string; message: string };
  }>(app, "/players", {
    method: "POST",
    body: JSON.stringify({ username: "  john   doe123  " }),
    headers: { "content-type": "application/json" },
  });

  assert.equal(response.status, 409);
  assert.equal(json?.error.code, "USERNAME_UNAVAILABLE");
  assert.match(json?.error.message ?? "", /choose another one/i);
});

test("POST /players rejects invalid usernames", async () => {
  const { app } = createTestApp();
  const { response, json } = await apiRequest<{
    error: { code: string; message: string };
  }>(app, "/players", {
    method: "POST",
    body: JSON.stringify({ username: "!!" }),
    headers: { "content-type": "application/json" },
  });

  assert.equal(response.status, 400);
  assert.equal(json?.error.code, "INVALID_USERNAME");
});

test("POST /players surfaces persistence failures as internal errors", async () => {
  class BrokenPlayersRepository implements PlayersRepository {
    async findByNormalizedUsername(): Promise<null> {
      return null;
    }

    async findByPlayerId(): Promise<null> {
      return null;
    }

    async createPlayer(_input: RegisterPlayerInput): Promise<never> {
      throw new Error("database unavailable");
    }

    async touchPlayer(): Promise<void> {}
  }

  const { app } = createTestApp({
    services: {
      players: new BrokenPlayersRepository(),
    },
  });
  const { response, json } = await apiRequest<{
    error: { code: string; message: string };
  }>(app, "/players", {
    method: "POST",
    body: JSON.stringify({ username: "Acme Cloud" }),
    headers: { "content-type": "application/json" },
  });

  assert.equal(response.status, 500);
  assert.equal(json?.error.code, "INTERNAL_SERVER_ERROR");
  assert.match(json?.error.message ?? "", /database unavailable/);
});

test("GET /players/availability rejects invalid usernames", async () => {
  const { app } = createTestApp();
  const { response, json } = await apiRequest<{
    error: { code: string; message: string };
  }>(app, "/players/availability?username=%20%20");

  assert.equal(response.status, 400);
  assert.equal(json?.error.code, "INVALID_USERNAME");
});

test("POST /players rate-limits repeated registration attempts from the same client", async () => {
  class DenyAllRateLimiter implements RateLimiter {
    consume(_scope: string, _key: string, _rule: RateLimitRule) {
      return {
        allowed: false,
        retryAfterSeconds: 42,
        remaining: 0,
      };
    }
  }

  const { app } = createTestApp({
    services: {
      rateLimiter: new DenyAllRateLimiter(),
    },
  });
  const { response, json } = await apiRequest<{
    error: { code: string; message: string };
  }>(app, "/players", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.10",
    },
    body: JSON.stringify({ username: "Acme Cloud" }),
  });

  assert.equal(response.status, 429);
  assert.equal(json?.error.code, "RATE_LIMITED");
  assert.match(json?.error.message ?? "", /Retry after 42 seconds/);
});

test("service-level username unavailable errors preserve their user-friendly contract", async () => {
  const error = new UsernameUnavailableError("Username is already taken.");

  assert.equal(error.code, "USERNAME_UNAVAILABLE");
});
