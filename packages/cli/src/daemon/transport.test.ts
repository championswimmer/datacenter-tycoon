import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { once } from "node:events";

import { SAVE_VERSION } from "@datacenter-tycoon/game-logic";

import { DaemonTransport } from "./transport.js";

function createSocketPath(): string {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "dct-cli-transport-"));
	return process.platform === "win32" ? `\\\\.\\pipe\\dct-transport-${Date.now()}` : path.join(directory, "d.sock");
}

test("DaemonTransport parses NDJSON requests and sends NDJSON responses", async () => {
	const socketPath = createSocketPath();
	const transport = new DaemonTransport({ socketPath });
	await transport.start();

	transport.on("request", (connection, request) => {
		assert.equal(request.method, "hello");
		transport.send(connection, {
			jsonrpc: "2.0",
			id: request.id ?? 1,
			result: {
				daemonVersion: "0.1.0",
				saveVersion: SAVE_VERSION,
				tick: 0,
			},
		});
	});

	const client = net.createConnection(socketPath);
	await once(client, "connect");

	const responseLine = new Promise<string>((resolve) => {
		let buffer = "";
		client.on("data", (chunk) => {
			buffer += chunk.toString();
			const newlineIndex = buffer.indexOf("\n");
			if (newlineIndex >= 0) {
				resolve(buffer.slice(0, newlineIndex));
			}
		});
	});

	client.write('{"jsonrpc":"2.0","id":1,"method":"hello","params":{"clientVersion":"test"}}\n');

	const response = JSON.parse(await responseLine) as {
		jsonrpc: string;
		id: number;
		result: { daemonVersion: string; saveVersion: number; tick: number };
	};
	assert.deepEqual(response, {
		jsonrpc: "2.0",
		id: 1,
		result: {
			daemonVersion: "0.1.0",
			saveVersion: SAVE_VERSION,
			tick: 0,
		},
	});

	client.end();
	await transport.close();
});

test("DaemonTransport buffers partial lines until a full request arrives", async () => {
	const socketPath = createSocketPath();
	const transport = new DaemonTransport({ socketPath });
	await transport.start();

	const requests: string[] = [];
	transport.on("request", (_connection, request) => {
		requests.push(request.method);
	});

	const client = net.createConnection(socketPath);
	await once(client, "connect");

	client.write('{"jsonrpc":"2.0","id":1,"method":"hel');
	client.write('lo"}\n');
	await new Promise((resolve) => setTimeout(resolve, 10));

	assert.deepEqual(requests, ["hello"]);

	client.end();
	await transport.close();
});
