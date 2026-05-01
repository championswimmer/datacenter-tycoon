import test from "node:test";
import assert from "node:assert/strict";

import { resolvePathsForPlatform } from "./paths.js";

test("resolvePathsForPlatform uses XDG paths on Linux", () => {
  const resolved = resolvePathsForPlatform({
    platform: "linux",
    env: {
      XDG_DATA_HOME: "/xdg/data",
      XDG_RUNTIME_DIR: "/xdg/runtime",
      XDG_STATE_HOME: "/xdg/state",
    },
    homeDir: "/home/alice",
    tempDir: "/tmp",
  });

  assert.deepEqual(resolved, {
    savePath: "/xdg/data/dct/save.json",
    socketPath: "/xdg/runtime/dct/dct.sock",
    pidPath: "/xdg/runtime/dct/dct.sock.pid",
    logPath: "/xdg/state/dct/daemon.log",
  });
});

test("resolvePathsForPlatform uses macOS conventions", () => {
  const resolved = resolvePathsForPlatform({
    platform: "darwin",
    env: {},
    homeDir: "/Users/alice",
    tempDir: "/var/folders/temp",
  });

  assert.deepEqual(resolved, {
    savePath: "/Users/alice/Library/Application Support/dct/save.json",
    socketPath: "/var/folders/temp/dct/dct.sock",
    pidPath: "/var/folders/temp/dct/dct.sock.pid",
    logPath: "/Users/alice/Library/Logs/dct/daemon.log",
  });
});

test("resolvePathsForPlatform uses Windows conventions", () => {
  const resolved = resolvePathsForPlatform({
    platform: "win32",
    env: {
      APPDATA: "C:\\Users\\alice\\AppData\\Roaming",
      LOCALAPPDATA: "C:\\Users\\alice\\AppData\\Local",
    },
    homeDir: "C:\\Users\\alice",
    tempDir: "C:\\Temp",
  });

  assert.deepEqual(resolved, {
    savePath: "C:\\Users\\alice\\AppData\\Roaming\\dct\\save.json",
    socketPath: "\\\\.\\pipe\\dct",
    pidPath: "\\\\.\\pipe\\dct.pid",
    logPath: "C:\\Users\\alice\\AppData\\Local\\dct\\Logs\\daemon.log",
  });
});

test("resolvePathsForPlatform honors explicit overrides", () => {
  const resolved = resolvePathsForPlatform({
    platform: "linux",
    env: {},
    homeDir: "/home/alice",
    tempDir: "/tmp",
    saveOverride: "/custom/save.json",
    socketOverride: "/custom/socket.sock",
  });

  assert.equal(resolved.savePath, "/custom/save.json");
  assert.equal(resolved.socketPath, "/custom/socket.sock");
  assert.equal(resolved.pidPath, "/custom/socket.sock.pid");
  assert.equal(resolved.logPath, "/home/alice/.local/state/dct/daemon.log");
});
