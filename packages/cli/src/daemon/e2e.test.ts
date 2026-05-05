import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { setTimeout as sleep } from "node:timers/promises";

import { DATACENTER_CATALOG, newGame } from "@datacenter-tycoon/game-logic";

import { loadOrInit, GamePersistence } from "./persist.js";
import { GameRuntime } from "./runtime.js";
import { GameDaemonServer } from "./server.js";
import { DaemonTransport } from "./transport.js";

function createTempPaths() {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "dct-cli-e2e-"));
	return {
		savePath: path.join(directory, "save.json"),
		socketPath: path.join(directory, "dct.sock"),
	};
}

async function sendRpcRequest(socketPath: string, request: unknown): Promise<unknown> {
	return await new Promise<unknown>((resolve, reject) => {
		const socket = net.createConnection(socketPath);
		let buffer = "";

		socket.once("connect", () => {
			socket.write(`${JSON.stringify(request)}\n`);
		});
		socket.on("data", (chunk) => {
			buffer += chunk.toString();
			const newlineIndex = buffer.indexOf("\n");
			if (newlineIndex < 0) {
				return;
			}

			const line = buffer.slice(0, newlineIndex);
			socket.end();
			resolve(JSON.parse(line));
		});
		socket.once("error", (error) => {
			socket.destroy();
			reject(error);
		});
	});
}

test("daemon server persists autosaved state after RPC dispatch", async () => {
	const { savePath, socketPath } = createTempPaths();
	const persistence = new GamePersistence({ savePath, debounceMs: 10 });
	const runtime = new GameRuntime({
		state: newGame(123, { startingCash: 3_000_000 }),
		paused: true,
	});
	const transport = new DaemonTransport({ socketPath });
	const server = new GameDaemonServer({
		transport,
		runtime,
		persistence,
	});

	await server.start();

	const helloResponse = (await sendRpcRequest(socketPath, {
		jsonrpc: "2.0",
		id: 1,
		method: "hello",
		params: { clientVersion: "test" },
	})) as { result: { tick: number } };
	assert.equal(helloResponse.result.tick, 0);

	const dispatchResponse = (await sendRpcRequest(socketPath, {
		jsonrpc: "2.0",
		id: 2,
		method: "dispatch",
		params: {
			type: "BuildDatacenter",
			specId: DATACENTER_CATALOG.garage.id,
			dcId: "dc-1",
			regionId: "us_west",
		},
	})) as { result: { tick: number } };
	assert.equal(dispatchResponse.result.tick, 0);

	await sleep(30);
	await persistence.waitForPendingFlush();

	const statusResponse = (await sendRpcRequest(socketPath, {
		jsonrpc: "2.0",
		id: 3,
		method: "query",
		params: { kind: "status" },
	})) as { result: { datacenterCount: number } };
	assert.equal(statusResponse.result.datacenterCount, 1);

	const reloadedState = loadOrInit(savePath, 999);
	assert.equal(reloadedState.datacenters.length, 1);
	assert.equal(reloadedState.datacenters[0]?.id, "dc-1");

	await server.close();
});
