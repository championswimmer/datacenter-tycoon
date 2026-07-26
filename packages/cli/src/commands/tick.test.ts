import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { newGame, type Action, type GameState } from "@datacenter-tycoon/game-logic";

import { parseArgv } from "../argv.js";
import { appendVerificationAction, createInitialVerifiedRunState } from "../online/verified-run.js";
import type { CommandClient } from "./common.js";
import { runTickCommand } from "./tick.js";

function createFakeClient(actions: Action[], snapshot: GameState = newGame(1)): CommandClient {
	const verification = createInitialVerifiedRunState(snapshot, { onlineEligible: true });
	return {
		connect: async () => undefined,
		dispatch: async (action) => {
			actions.push(action);
			Object.assign(verification, appendVerificationAction(verification, action));
			return { tick: actions.length };
		},
		query: async (params) => {
			if (params.kind === "snapshot") {
				return snapshot;
			}
			if (params.kind === "verification") {
				return verification;
			}

			return {
				tick: actions.length,
				subtick: 0,
				dayOfMonth: 1,
				paused: true,
				speedTps: 0,
				cash: 100,
				difficulty: "hard" as const,
				datacenterCount: 0,
				rackCount: 0,
				activeContractCount: 0,
				marketContractCount: 0,
			};
		},
		control: async (params) => {
			if (params.op === "set-verification") {
				Object.assign(verification, params.verification);
			}
			return { ok: true };
		},
		close: async () => undefined,
	};
}

async function captureConsole(run: () => Promise<void>): Promise<string[]> {
	const printed: string[] = [];
	const originalLog = console.log;
	console.log = (message?: unknown) => {
		printed.push(String(message ?? ""));
	};

	try {
		await run();
	} finally {
		console.log = originalLog;
	}

	return printed;
}

async function startLeaderboardServer(): Promise<{
	baseUrl: string;
	requests: Array<{ method: string; path: string; body: string }>;
	close: () => Promise<void>;
}> {
	const requests: Array<{ method: string; path: string; body: string }> = [];
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

			response.statusCode = 201;
			response.setHeader("content-type", "application/json");
			response.end(JSON.stringify({
				created: true,
				rootHash: "a".repeat(64),
				headHash: "b".repeat(64),
				gameMonth: 1,
				metrics: {
					money: 500_000,
					cumulativeRevenue: 0,
					totalServers: 0,
					computeCapacity: 0,
					memoryCapacity: 0,
					storageCapacity: 0,
					gpuCapacity: 0,
				},
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

test("runTickCommand dispatches Tick actions and queries status", async () => {
	const actions: Action[] = [];
	await runTickCommand(parseArgv(["tick", "3", "--quiet"]), () => createFakeClient(actions));
	assert.deepEqual(actions, [{ type: "Tick" }, { type: "Tick" }, { type: "Tick" }]);
});

test("runTickCommand keeps month-based wording for compatibility", async () => {
	const actions: Action[] = [];
	const printed = await captureConsole(() =>
		runTickCommand(parseArgv(["tick", "2"]), () => createFakeClient(actions))
	);

	assert.deepEqual(actions, [{ type: "Tick" }, { type: "Tick" }]);
	assert.match(printed[0] ?? "", /Advanced 2 months to tick 2/);
});

test("runTickCommand submits the verified leaderboard payload when a profile and server are configured", async () => {
	const actions: Action[] = [];
	const server = await startLeaderboardServer();
	const snapshot = newGame(123);
	snapshot.gameId = "game-123";
	snapshot.tick = 1;
	snapshot.player.cash = 500_000;

	try {
		const printed = await captureConsole(() =>
			runTickCommand(
				parseArgv(["tick", "1", "--json", "--server", server.baseUrl]),
				() => createFakeClient(actions, snapshot),
				{
					readProfile: async () => ({
						serverUrl: "https://profile.example.test",
						playerId: "player_123",
						username: "Acme Cloud",
					}),
				},
			),
		);
		const payload = JSON.parse(printed[0] ?? "{}") as {
			data?: {
				tick: number;
				onlineSync?: {
					status: string;
					response?: { headHash: string };
				};
			};
		};
		const submission = JSON.parse(server.requests[0]?.body ?? "{}") as {
			playerId: string;
			clientRunId: string;
			parentHeadHash: string | null;
			actions: Array<{ type: string }>;
		};

		assert.deepEqual(actions, [{ type: "Tick" }]);
		assert.equal(server.requests.length, 1);
		assert.equal(server.requests[0]?.method, "POST");
		assert.equal(server.requests[0]?.path, "/leaderboard/runs");
		assert.equal(submission.playerId, "player_123");
		assert.equal(submission.clientRunId, "game-123");
		assert.equal(submission.parentHeadHash, null);
		assert.deepEqual(submission.actions, [{ type: "Tick" }]);
		assert.equal(payload.data?.tick, 1);
		assert.equal(payload.data?.onlineSync?.status, "submitted");
		assert.match(payload.data?.onlineSync?.response?.headHash ?? "", /^[a-f0-9]{64}$/);
	} finally {
		await server.close();
	}
});

test("runTickCommand treats unreachable online sync targets as warnings instead of failing gameplay", async () => {
	const actions: Action[] = [];
	const snapshot = newGame(456);
	snapshot.tick = 2;
	const port = await reserveClosedPort();

	const printed = await captureConsole(() =>
		runTickCommand(
			parseArgv(["tick", "1", "--json", "--server", `http://127.0.0.1:${port}`]),
			() => createFakeClient(actions, snapshot),
			{
				readProfile: async () => ({
					serverUrl: `http://127.0.0.1:${port}`,
					playerId: "player_123",
					username: "Acme Cloud",
				}),
			},
		),
	);
	const payload = JSON.parse(printed[0] ?? "{}") as {
		data?: {
			tick: number;
			onlineSync?: { status: string; message: string };
		};
	};

	assert.deepEqual(actions, [{ type: "Tick" }]);
	assert.equal(payload.data?.tick, 1);
	assert.equal(payload.data?.onlineSync?.status, "warning");
	assert.match(payload.data?.onlineSync?.message ?? "", /ECONNREFUSED|fetch failed|connect/i);
});
