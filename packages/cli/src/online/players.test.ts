import assert from "node:assert/strict";
import test from "node:test";

import {
  isRegistrationUnavailableError,
  PlayerRegistrationError,
  registerPlayer,
} from "./players.js";

test("registerPlayer posts the username and returns a normalized CLI profile", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;

  const result = await registerPlayer(
    {
      serverUrl: " https://api.dctycoon.test/ ",
      username: "Acme Cloud",
    },
    async (input, init) => {
      requestUrl = String(input);
      requestInit = init;

      return new Response(JSON.stringify({
        playerId: "player_123",
        username: "Acme Cloud",
      }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    },
  );

  assert.equal(requestUrl, "https://api.dctycoon.test/players");
  assert.equal(requestInit?.method, "POST");
  assert.equal(requestInit?.body, JSON.stringify({ username: "Acme Cloud" }));
  assert.deepEqual(result, {
    serverUrl: "https://api.dctycoon.test",
    playerId: "player_123",
    username: "Acme Cloud",
  });
});

test("registerPlayer surfaces structured API errors", async () => {
  await assert.rejects(
    () => registerPlayer(
      {
        serverUrl: "https://api.dctycoon.test",
        username: "taken-name",
      },
      async () => new Response(JSON.stringify({
        error: {
          code: "USERNAME_UNAVAILABLE",
          message: "That username is already taken.",
        },
      }), {
        status: 409,
        headers: { "content-type": "application/json" },
      }),
    ),
    (error: unknown) => {
      assert.ok(error instanceof PlayerRegistrationError);
      assert.equal(error.code, "USERNAME_UNAVAILABLE");
      assert.equal(error.status, 409);
      assert.equal(isRegistrationUnavailableError(error), false);
      return true;
    },
  );
});

test("registerPlayer reports disabled and unreachable servers as unavailable", async () => {
  await assert.rejects(
    () => registerPlayer({ serverUrl: null, username: "Acme Cloud" }),
    (error: unknown) => {
      assert.ok(error instanceof PlayerRegistrationError);
      assert.equal(error.code, "ONLINE_SYNC_DISABLED");
      assert.equal(error.status, null);
      assert.equal(isRegistrationUnavailableError(error), true);
      return true;
    },
  );

  await assert.rejects(
    () => registerPlayer(
      {
        serverUrl: "https://api.dctycoon.test",
        username: "Acme Cloud",
      },
      async () => {
        throw new Error("connect ECONNREFUSED 127.0.0.1:3000");
      },
    ),
    (error: unknown) => {
      assert.ok(error instanceof PlayerRegistrationError);
      assert.equal(error.code, "NETWORK_ERROR");
      assert.equal(error.status, null);
      assert.equal(isRegistrationUnavailableError(error), true);
      return true;
    },
  );
});
