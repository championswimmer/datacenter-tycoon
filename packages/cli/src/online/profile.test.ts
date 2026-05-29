import assert from "node:assert/strict";
import test from "node:test";

import {
  CLI_ONLINE_SERVER_ENV,
  ONLINE_COMMAND_SUMMARY,
  resolveOnlineTarget,
} from "./profile.js";

test("resolveOnlineTarget prefers the --server flag over stored profile and env", () => {
  const target = resolveOnlineTarget({
    flagServerUrl: " http://flag.example.test/ ",
    profile: {
      serverUrl: "https://profile.example.test",
    },
    env: {
      [CLI_ONLINE_SERVER_ENV]: "https://env.example.test",
    },
  });

  assert.deepEqual(target, {
    serverUrl: "http://flag.example.test",
    source: "flag",
  });
});

test("resolveOnlineTarget falls back to the stored profile before env", () => {
  const target = resolveOnlineTarget({
    profile: {
      serverUrl: "https://profile.example.test///",
    },
    env: {
      [CLI_ONLINE_SERVER_ENV]: "https://env.example.test",
    },
  });

  assert.deepEqual(target, {
    serverUrl: "https://profile.example.test",
    source: "profile",
  });
});

test("resolveOnlineTarget uses the scripting env when no flag or profile exists", () => {
  const target = resolveOnlineTarget({
    env: {
      [CLI_ONLINE_SERVER_ENV]: "https://env.example.test/api/",
    },
  });

  assert.deepEqual(target, {
    serverUrl: "https://env.example.test/api",
    source: "env",
  });
});

test("resolveOnlineTarget disables online sync when every source is blank", () => {
  const target = resolveOnlineTarget({
    flagServerUrl: "   ",
    profile: {
      serverUrl: "",
    },
    env: {
      [CLI_ONLINE_SERVER_ENV]: " ",
    },
  });

  assert.deepEqual(target, {
    serverUrl: null,
    source: "disabled",
  });
});

test("ONLINE_COMMAND_SUMMARY records the planned noun-first command surface", () => {
  assert.match(ONLINE_COMMAND_SUMMARY, /login/);
  assert.match(ONLINE_COMMAND_SUMMARY, /status/);
  assert.match(ONLINE_COMMAND_SUMMARY, /logout/);
  assert.match(ONLINE_COMMAND_SUMMARY, /submit/);
});
