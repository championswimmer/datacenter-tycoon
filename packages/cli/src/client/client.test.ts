import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { once } from "node:events";

import { DctClient } from "./client.js";

function createSocketPath(): string {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "dct-cli-client-"));
	return process.platform === "win32" ? `\\\\.\\pipe\\dct-client-${Date.now()}` : path.join(directory, "d.sock");
}

test("DctClient sends requests and receives subscription events from a mock server", async () => {
	const socketPath = createSocketPath();
	const server = net.createServer((socket) => {
		let buffer = "";
		socket.on("data", (chunk) => {
			buffer += chunk.toString();
			const lines = buffer.split("\n");
			buffer = lines.pop() ?? "";
			for (const line of lines) {
				if (!line.trim()) {
					continue;
				}

				const request = JSON.parse(line) as { id: number; method: string };
				switch (request.method) {
					case "hello":
						socket.write(`{"jsonrpc":"2.0","id":${request.id},"result":{"daemonVersion":"0.1.0","saveVersion":1,"tick":0}}\n`);
						break;
					case "query":
						socket.write(`{"jsonrpc":"2.0","id":${request.id},"result":{"tick":7,"cash":5000,"datacenterCount":1,"rackCount":2,"activeContractCount":0,"marketContractCount":4,"paused":false,"speedTps":1}}\n`);
						break;
					case "subscribe":
						socket.write(`{"jsonrpc":"2.0","id":${request.id},"result":{"subId":99}}\n`);
						setTimeout(() => {
							socket.write('{"jsonrpc":"2.0","method":"event","params":{"subId":99,"event":{"type":"tick","tick":8}}}\n');
						}, 10);
						break;
					case "unsubscribe":
						socket.write(`{"jsonrpc":"2.0","id":${request.id},"result":{"ok":true}}\n`);
						break;
					case "control":
						socket.write(`{"jsonrpc":"2.0","id":${request.id},"result":{"ok":true}}\n`);
						break;
					default:
						socket.write(`{"jsonrpc":"2.0","id":${request.id},"error":{"code":-32601,"message":"Unknown method"}}\n`);
				}
			}
		});
	});
	server.listen(socketPath);
	await once(server, "listening");

	const client = new DctClient({ socketPath });
	await client.connect();

	const hello = await client.hello({ clientVersion: "0.1.0" });
	assert.equal(hello.tick, 0);

	const status = (await client.query({ kind: "status" })) as {
		tick: number;
		datacenterCount: number;
	};
	assert.equal(status.tick, 7);
	assert.equal(status.datacenterCount, 1);

	let receivedEventTick: number | undefined;
	const subscription = await client.subscribe(["tick"], (event) => {
		receivedEventTick = event.tick;
	});
	await new Promise((resolve) => setTimeout(resolve, 30));
	assert.equal(receivedEventTick, 8);

	const controlResult = await client.control({ op: "pause" });
	assert.equal(controlResult.ok, true);

	const unsubscribeResult = await subscription.unsubscribe();
	assert.equal(unsubscribeResult.ok, true);

	await client.close();
	server.close();
	await once(server, "close");
});

test("DctClient rejects pending requests when the socket closes", async () => {
	const socketPath = createSocketPath();
	const server = net.createServer((socket) => {
		socket.on("data", () => {
			socket.destroy();
		});
	});
	server.listen(socketPath);
	await once(server, "listening");

	const client = new DctClient({ socketPath });
	await client.connect();

	await assert.rejects(() => client.hello({ clientVersion: "0.1.0" }), /Socket closed/);

	server.close();
	await once(server, "close");
});

test("DctClient reconnects and performs handshake again on a new socket", async () => {
	const socketPath = createSocketPath();
	let connectionCount = 0;
	const server = net.createServer((socket) => {
		connectionCount += 1;
		let buffer = "";
		socket.on("data", (chunk) => {
			buffer += chunk.toString();
			const lines = buffer.split("\n");
			buffer = lines.pop() ?? "";
			for (const line of lines) {
				if (!line.trim()) {
					continue;
				}
				const request = JSON.parse(line) as { id: number; method: string };
				if (request.method === "hello") {
					socket.write(`{"jsonrpc":"2.0","id":${request.id},"result":{"daemonVersion":"0.1.0","saveVersion":1,"tick":${connectionCount}}}\n`);
				} else if (request.method === "query") {
					socket.write(`{"jsonrpc":"2.0","id":${request.id},"result":{"tick":${connectionCount},"cash":5000,"datacenterCount":1,"rackCount":2,"activeContractCount":0,"marketContractCount":4,"paused":false,"speedTps":1}}\n`);
				}
			}
		});
	});
	server.listen(socketPath);
	await once(server, "listening");

	const client = new DctClient({ socketPath });
	await client.connect();
	const firstHandshake = await client.handshake();
	assert.equal(firstHandshake.tick, 1);

	await client.reconnect();
	const secondHandshake = await client.handshake();
	assert.equal(secondHandshake.tick, 2);
	assert.equal(connectionCount, 2);

	await client.close();
	server.close();
	await once(server, "close");
});

test("DctClient rejects incompatible daemon major versions during handshake", async () => {
	const socketPath = createSocketPath();
	const server = net.createServer((socket) => {
		socket.on("data", (chunk) => {
			const line = chunk.toString().trim();
			if (!line) {
				return;
			}
			const request = JSON.parse(line) as { id: number; method: string };
			if (request.method === "hello") {
				socket.write(`{"jsonrpc":"2.0","id":${request.id},"result":{"daemonVersion":"2.0.0","saveVersion":1,"tick":0}}\n`);
			}
		});
	});
	server.listen(socketPath);
	await once(server, "listening");

	const client = new DctClient({ socketPath, clientVersion: "1.0.0" });
	await client.connect();
	await assert.rejects(() => client.handshake(), /incompatible with client 1.0.0/);

	await client.close();
	server.close();
	await once(server, "close");
});
