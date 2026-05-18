import assert from "node:assert/strict";
import { test } from "node:test";
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

test("normalized usernames collapse case differences for uniqueness", () => {
  const first = parseUsernameRegistration("Acme.Cloud");
  const second = parseUsernameRegistration(" acme.cloud ");

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

test("generatePlayerId creates opaque player ids with a stable prefix", () => {
  const playerId = generatePlayerId();

  assert.match(playerId, /^player_[a-f0-9]{32}$/);
});
