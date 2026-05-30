import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  clearOnlineProfile,
  CLI_ONLINE_SERVER_ENV,
  CliOnlineProfileError,
  ONLINE_COMMAND_SUMMARY,
  readOnlineProfile,
  resolveOnlineTarget,
  writeOnlineProfile,
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

test("writeOnlineProfile normalizes and round-trips CLI identity data", async () => {
  const profileDir = await mkdtemp(join(tmpdir(), "dct-online-profile-"));
  const profilePath = join(profileDir, "online-profile.json");

  try {
    const written = await writeOnlineProfile(profilePath, {
      serverUrl: " https://api.dctycoon.test/ ",
      playerId: " player_123 ",
      username: " Acme Cloud ",
    });

    const rawProfile = await readFile(profilePath, "utf8");
    const readBack = await readOnlineProfile(profilePath);

    assert.deepEqual(written, {
      serverUrl: "https://api.dctycoon.test",
      playerId: "player_123",
      username: "Acme Cloud",
    });
    assert.match(rawProfile, /"serverUrl": "https:\/\/api.dctycoon.test"/);
    assert.deepEqual(readBack, written);

    await clearOnlineProfile(profilePath);
    assert.equal(await readOnlineProfile(profilePath), null);
  } finally {
    await rm(profileDir, { recursive: true, force: true });
  }
});

test("readOnlineProfile rejects invalid persisted payloads", async () => {
  const profileDir = await mkdtemp(join(tmpdir(), "dct-online-profile-invalid-"));
  const profilePath = join(profileDir, "online-profile.json");

  try {
    await writeFile(profilePath, JSON.stringify({
      serverUrl: 42,
      playerId: "player_123",
      username: "Acme Cloud",
    }));

    await assert.rejects(
      () => readOnlineProfile(profilePath),
      (error: unknown) => {
        assert.ok(error instanceof CliOnlineProfileError);
        assert.equal(error.code, "INVALID_ONLINE_PROFILE");
        assert.equal(error.profilePath, profilePath);
        return true;
      },
    );
  } finally {
    await rm(profileDir, { recursive: true, force: true });
  }
});

test("ONLINE_COMMAND_SUMMARY records the planned noun-first command surface", () => {
  assert.match(ONLINE_COMMAND_SUMMARY, /login/);
  assert.match(ONLINE_COMMAND_SUMMARY, /status/);
  assert.match(ONLINE_COMMAND_SUMMARY, /logout/);
  assert.match(ONLINE_COMMAND_SUMMARY, /submit/);
});
