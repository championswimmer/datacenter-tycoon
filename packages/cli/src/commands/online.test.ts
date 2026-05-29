import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { parseArgv } from "../argv.js";
import type { CommandClient } from "./common.js";
import { readOnlineProfile, writeOnlineProfile } from "../online/profile.js";
import { PlayerRegistrationError } from "../online/players.js";
import { runOnlineCommand, type OnlineCommandDependencies } from "./online.js";

interface CapturedRequest {
  method: string;
  path: string;
  body: string;
}

async function captureConsole(run: () => Promise<void>): Promise<string[]> {
  const printed: string[] = [];
  const originalConsoleLog = console.log;
  console.log = (message?: unknown) => {
    printed.push(String(message));
  };

  try {
    await run();
  } finally {
    console.log = originalConsoleLog;
  }

  return printed;
}

function createDependencies(profilePath: string, overrides: Partial<OnlineCommandDependencies> = {}): OnlineCommandDependencies {
  return {
    env: {},
    resolvePaths: () => ({ onlineProfilePath: profilePath }),
    ...overrides,
  };
}

async function startPlayerServer(options: {
  status?: number;
  body?: unknown;
} = {}): Promise<{
  baseUrl: string;
  requests: CapturedRequest[];
  close: () => Promise<void>;
}> {
  const requests: CapturedRequest[] = [];
  const server = createServer((request, response) => {
    const bodyChunks: Buffer[] = [];
    request.on("data", (chunk) => {
      bodyChunks.push(Buffer.from(chunk));
    });
    request.on("end", () => {
      requests.push({
        method: request.method ?? "GET",
        path: request.url ?? "/",
        body: Buffer.concat(bodyChunks).toString("utf8"),
      });

      response.statusCode = options.status ?? 201;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(options.body ?? {
        playerId: "player_123",
        username: "Acme Cloud",
      }));
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected TCP server address.");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    },
  };
}

async function reserveClosedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected TCP server address.");
  }

  const port = address.port;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

  return port;
}

test("runOnlineCommand login registers against a test server and persists the profile", async () => {
  const profileDir = await mkdtemp(join(tmpdir(), "dct-online-command-"));
  const profilePath = join(profileDir, "online-profile.json");
  const server = await startPlayerServer();

  try {
    const printed = await captureConsole(() =>
      runOnlineCommand(
        parseArgv(["online", "login", "--username", "Acme Cloud", "--server", server.baseUrl, "--json"]),
        createDependencies(profilePath),
      ),
    );

    const output = JSON.parse(printed[0] ?? "{}") as {
      data?: {
        profile?: { playerId: string; username: string; serverUrl: string };
        target?: { source: string };
      };
    };
    const storedProfile = await readOnlineProfile(profilePath);

    assert.equal(server.requests.length, 1);
    assert.deepEqual(server.requests[0], {
      method: "POST",
      path: "/players",
      body: JSON.stringify({ username: "Acme Cloud" }),
    });
    assert.deepEqual(output.data?.profile, {
      playerId: "player_123",
      username: "Acme Cloud",
      serverUrl: server.baseUrl,
    });
    assert.equal(output.data?.target?.source, "flag");
    assert.deepEqual(storedProfile, {
      playerId: "player_123",
      username: "Acme Cloud",
      serverUrl: server.baseUrl,
    });
  } finally {
    await server.close();
    await rm(profileDir, { recursive: true, force: true });
  }
});

test("runOnlineCommand status reuses the stored profile and logout clears it", async () => {
  const profileDir = await mkdtemp(join(tmpdir(), "dct-online-command-status-"));
  const profilePath = join(profileDir, "online-profile.json");

  try {
    await writeOnlineProfile(profilePath, {
      serverUrl: "https://api.dctycoon.test/",
      playerId: "player_123",
      username: "Acme Cloud",
    });

    const statusPrinted = await captureConsole(() =>
      runOnlineCommand(
        parseArgv(["online", "status", "--json"]),
        createDependencies(profilePath),
      ),
    );
    const statusOutput = JSON.parse(statusPrinted[0] ?? "{}") as {
      data?: {
        loggedIn: boolean;
        profile?: { username: string };
        target?: { source: string; serverUrl: string };
      };
    };

    assert.equal(statusOutput.data?.loggedIn, true);
    assert.equal(statusOutput.data?.profile?.username, "Acme Cloud");
    assert.equal(statusOutput.data?.target?.source, "profile");
    assert.equal(statusOutput.data?.target?.serverUrl, "https://api.dctycoon.test");

    const logoutPrinted = await captureConsole(() =>
      runOnlineCommand(
        parseArgv(["online", "logout", "--json"]),
        createDependencies(profilePath),
      ),
    );
    const logoutOutput = JSON.parse(logoutPrinted[0] ?? "{}") as {
      data?: { cleared: boolean };
    };

    assert.equal(logoutOutput.data?.cleared, true);
    assert.equal(await readOnlineProfile(profilePath), null);
  } finally {
    await rm(profileDir, { recursive: true, force: true });
  }
});

test("runOnlineCommand login preserves invalid-username API errors", async () => {
  const profileDir = await mkdtemp(join(tmpdir(), "dct-online-command-invalid-"));
  const profilePath = join(profileDir, "online-profile.json");
  const server = await startPlayerServer({
    status: 400,
    body: {
      error: {
        code: "INVALID_USERNAME",
        message: "Username must be 3-20 characters.",
      },
    },
  });

  try {
    await assert.rejects(
      () =>
        runOnlineCommand(
          parseArgv(["online", "login", "--username", "x", "--server", server.baseUrl]),
          createDependencies(profilePath),
        ),
      (error: unknown) => {
        assert.ok(error instanceof PlayerRegistrationError);
        assert.equal(error.code, "INVALID_USERNAME");
        assert.equal(error.status, 400);
        return true;
      },
    );
  } finally {
    await server.close();
    await rm(profileDir, { recursive: true, force: true });
  }
});

test("runOnlineCommand login preserves unreachable-server errors", async () => {
  const profileDir = await mkdtemp(join(tmpdir(), "dct-online-command-offline-"));
  const profilePath = join(profileDir, "online-profile.json");
  const port = await reserveClosedPort();

  try {
    await assert.rejects(
      () =>
        runOnlineCommand(
          parseArgv(["online", "login", "--username", "Acme Cloud", "--server", `http://127.0.0.1:${port}`]),
          createDependencies(profilePath),
        ),
      (error: unknown) => {
        assert.ok(error instanceof PlayerRegistrationError);
        assert.equal(error.code, "NETWORK_ERROR");
        assert.equal(error.status, null);
        return true;
      },
    );
  } finally {
    await rm(profileDir, { recursive: true, force: true });
  }
});

test("runOnlineCommand submit reports the sync result through the noun-first router", async () => {
  const fakeClient: CommandClient = {
    connect: async () => undefined,
    dispatch: async () => ({ tick: 0 }),
    query: async () => ({ tick: 0 }),
    control: async () => ({ ok: true }),
    close: async () => undefined,
  };

  const printed = await captureConsole(() =>
    runOnlineCommand(
      parseArgv(["online", "submit", "--json"]),
      {
        clientFactory: () => fakeClient,
        syncLeaderboard: async () => ({
          status: "submitted",
          message: "Submitted leaderboard run run_123.",
          profile: null,
          target: {
            serverUrl: "https://api.dctycoon.test",
            source: "profile",
          },
          profilePath: "/tmp/online-profile.json",
          syncStatePath: "/tmp/online-sync.json",
        }),
      },
    ),
  );
  const output = JSON.parse(printed[0] ?? "{}") as {
    data?: {
      onlineSync?: {
        status: string;
        message: string;
      };
    };
  };

  assert.equal(output.data?.onlineSync?.status, "submitted");
  assert.equal(output.data?.onlineSync?.message, "Submitted leaderboard run run_123.");
});
