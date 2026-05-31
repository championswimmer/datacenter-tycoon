import assert from "node:assert/strict";
import { test } from "bun:test";
import {
  MAX_USERNAME_LENGTH,
  MIN_USERNAME_LENGTH,
  generatePlayerId,
  parseUsernameRegistration,
  UsernameValidationError,
} from "./identity.js";

test("parseUsernameRegistration accepts valid usernames and normalizes whitespace", () => {
  assert.deepEqual(parseUsernameRegistration("  Acme   Cloud  "), {
    username: "Acme Cloud",
    normalizedUsername: "acme cloud",
  });
});

test("parseUsernameRegistration rejects usernames that are too short", () => {
  assert.throws(
    () => parseUsernameRegistration("ab"),
    (error: unknown) => {
      assert.ok(error instanceof UsernameValidationError);
      assert.match(error.message, new RegExp(String(MIN_USERNAME_LENGTH)));
      return true;
    },
  );
});

test("parseUsernameRegistration rejects usernames with unsupported characters", () => {
  assert.throws(
    () => parseUsernameRegistration("Acme🚀"),
    (error: unknown) => {
      assert.ok(error instanceof UsernameValidationError);
      assert.match(error.message, /letters, numbers/);
      return true;
    },
  );
});

test("normalized usernames collapse case and repeated whitespace differences for uniqueness", () => {
  const first = parseUsernameRegistration("John Doe123");
  const second = parseUsernameRegistration("  john   doe123  ");

  assert.equal(first.normalizedUsername, second.normalizedUsername);
});

test("parseUsernameRegistration rejects usernames that are too long", () => {
  assert.throws(
    () => parseUsernameRegistration("x".repeat(MAX_USERNAME_LENGTH + 1)),
    (error: unknown) => {
      assert.ok(error instanceof UsernameValidationError);
      assert.match(error.message, new RegExp(String(MAX_USERNAME_LENGTH)));
      return true;
    },
  );
});

test("generatePlayerId creates UUID player ids", () => {
  const playerId = generatePlayerId();

  assert.match(
    playerId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
});
