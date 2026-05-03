import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { DATACENTER_CATALOG, RACK_CATALOG, SAVE_VERSION, newGame, reduce, type DatacenterId, type RackPlacementId } from "@datacenter-tycoon/game-logic";

import { RpcErrorCode } from "../protocol/messages.js";
import { GamePersistence } from "./persist.js";
import { GameRuntime } from "./runtime.js";
import { GameDaemonServer } from "./server.js";
import type { TransportConnection } from "./transport.js";

const datacenterId = (value: string): DatacenterId => value as DatacenterId;
const rackPlacementId = (value: string): RackPlacementId => value as RackPlacementId;

function createTempSavePath(): string {
	const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "dct-cli-server-"));
	return path.join(tempDirectory, "save.json");
}

class FakeTransport {
	readonly requestHandlers = new Set<(connection: TransportConnection, request: { id?: number; method: string; params?: unknown }) => void | Promise<void>>();
	readonly disconnectHandlers = new Set<(connection: TransportConnection) => void>();
	readonly invalidMessageHandlers = new Set<(connection: TransportConnection, rawMessage: string, error: Error) => void>();
	readonly sentByConnection = new Map<number, unknown[]>();
	started = false;
	closed = false;

	on(event: "request" | "disconnect" | "invalidMessage", handler: (...args: unknown[]) => void): this {
		if (event === "request") {
			this.requestHandlers.add(handler as (connection: TransportConnection, request: { id?: number; method: string; params?: unknown }) => void | Promise<void>);
		} else if (event === "disconnect") {
			this.disconnectHandlers.add(handler as (connection: TransportConnection) => void);
		} else {
			this.invalidMessageHandlers.add(handler as (connection: TransportConnection, rawMessage: string, error: Error) => void);
		}
		return this;
	}

	off(event: "request" | "disconnect" | "invalidMessage", handler: (...args: unknown[]) => void): this {
		if (event === "request") {
			this.requestHandlers.delete(handler as (connection: TransportConnection, request: { id?: number; method: string; params?: unknown }) => void | Promise<void>);
		} else if (event === "disconnect") {
			this.disconnectHandlers.delete(handler as (connection: TransportConnection) => void);
		} else {
			this.invalidMessageHandlers.delete(handler as (connection: TransportConnection, rawMessage: string, error: Error) => void);
		}
		return this;
	}

	async start(): Promise<void> {
		this.started = true;
	}

	async close(): Promise<void> {
		this.closed = true;
	}

	send(connection: TransportConnection, message: unknown): boolean {
		const messages = this.sentByConnection.get(connection.id) ?? [];
		messages.push(message);
		this.sentByConnection.set(connection.id, messages);
		return true;
	}

	async emitRequest(connection: TransportConnection, request: { id?: number; method: string; params?: unknown }): Promise<void> {
		for (const handler of this.requestHandlers) {
			await handler(connection, request);
		}
	}

	emitDisconnect(connection: TransportConnection): void {
		for (const handler of this.disconnectHandlers) {
			handler(connection);
		}
	}

	emitInvalidMessage(connection: TransportConnection, rawMessage: string, error: Error): void {
		for (const handler of this.invalidMessageHandlers) {
			handler(connection, rawMessage, error);
		}
	}

	lastMessage(connection: TransportConnection): { id: number; result?: unknown; error?: { code: number; message: string } } {
		const messages = this.sentByConnection.get(connection.id) ?? [];
		const lastMessage = messages.at(-1);
		if (!lastMessage) {
			throw new Error("No message sent");
		}
		return lastMessage as { id: number; result?: unknown; error?: { code: number; message: string } };
	}
}

function createConnection(id: number): TransportConnection {
	return { id, socket: new net.Socket() };
}

function createRuntime() {
	let state = newGame(42, { startingCash: 3_000_000 });
	const firstRegionId = state.map.regions[0]!.id;
	state = reduce(state, {
		type: "BuildDatacenter",
		specId: DATACENTER_CATALOG.garage.id,
		dcId: datacenterId("dc-1"),
		regionId: firstRegionId,
	});
	state = reduce(state, {
		type: "PlaceRack",
		dcId: datacenterId("dc-1"),
		specId: RACK_CATALOG.C1.id,
		row: 0,
		position: 0,
		placementId: rackPlacementId("rp-1"),
	});
	return new GameRuntime({ state, paused: true });
}

test("GameDaemonServer handles hello and invalid methods", async () => {
	const transport = new FakeTransport();
	const server = new GameDaemonServer({
		transport: transport as never,
		runtime: createRuntime(),
		persistence: new GamePersistence({ savePath: createTempSavePath() }),
	});
	await server.start();
	const connection = createConnection(1);

	await transport.emitRequest(connection, { id: 1, method: "hello", params: { clientVersion: "test" } });
	assert.deepEqual(transport.lastMessage(connection), {
		jsonrpc: "2.0",
		id: 1,
		result: {
			daemonVersion: GameRuntime.getVersion(),
			saveVersion: SAVE_VERSION,
			tick: 0,
		},
	});

	await transport.emitRequest(connection, { id: 2, method: "wat", params: {} });
	assert.equal(transport.lastMessage(connection).error?.code, RpcErrorCode.MethodNotFound);

	await server.close();
});

test("GameDaemonServer handles dispatch and query errors", async () => {
	const transport = new FakeTransport();
	const server = new GameDaemonServer({
		transport: transport as never,
		runtime: createRuntime(),
		persistence: new GamePersistence({ savePath: createTempSavePath() }),
	});
	await server.start();
	const connection = createConnection(1);

	await transport.emitRequest(connection, { id: 1, method: "dispatch", params: { type: "Tick" } });
	assert.deepEqual(transport.lastMessage(connection), { jsonrpc: "2.0", id: 1, result: { tick: 1 } });

	await transport.emitRequest(connection, {
		id: 2,
		method: "dispatch",
		params: { type: "RemoveRack", dcId: "dc-1", placementId: "missing-rack" },
	});
	assert.equal(transport.lastMessage(connection).error?.code, RpcErrorCode.RuntimeError);

	await transport.emitRequest(connection, { id: 3, method: "query", params: { kind: "status" } });
	assert.equal((transport.lastMessage(connection).result as { tick: number }).tick, 1);

	await transport.emitRequest(connection, { id: 4, method: "query", params: { kind: "list", target: "racks" } });
	assert.equal(transport.lastMessage(connection).error?.code, RpcErrorCode.RuntimeError);

	await server.close();
});

test("GameDaemonServer handles subscribe, unsubscribe, and event fanout", async () => {
	const transport = new FakeTransport();
	const runtime = createRuntime();
	const server = new GameDaemonServer({
		transport: transport as never,
		runtime,
		persistence: new GamePersistence({ savePath: createTempSavePath() }),
	});
	await server.start();
	const connection = createConnection(1);

	await transport.emitRequest(connection, { id: 1, method: "subscribe", params: { events: ["tick"] } });
	const subscribeMessage = transport.lastMessage(connection);
	assert.equal((subscribeMessage.result as { subId: number }).subId, 1);

	runtime.dispatch({ type: "Tick" });
	const eventMessage = transport.lastMessage(connection) as {
		method: string;
		params: { subId: number; event: { type: string; tick: number } };
	};
	assert.equal(eventMessage.method, "event");
	assert.equal(eventMessage.params.event.type, "tick");

	await transport.emitRequest(connection, { id: 2, method: "unsubscribe", params: { subId: 1 } });
	assert.deepEqual(transport.lastMessage(connection), { jsonrpc: "2.0", id: 2, result: { ok: true } });

	await transport.emitRequest(connection, { id: 3, method: "unsubscribe", params: { subId: 99 } });
	assert.equal(transport.lastMessage(connection).error?.code, RpcErrorCode.NotSubscribed);

	await server.close();
});

test("GameDaemonServer handles control operations and parse errors", async () => {
	const savePath = createTempSavePath();
	const transport = new FakeTransport();
	let shutdownRequested = false;
	const runtime = createRuntime();
	const server = new GameDaemonServer({
		transport: transport as never,
		runtime,
		persistence: new GamePersistence({ savePath }),
		onShutdownRequest: () => {
			shutdownRequested = true;
		},
	});
	await server.start();
	const connection = createConnection(1);

	await transport.emitRequest(connection, { id: 1, method: "control", params: { op: "pause" } });
	assert.deepEqual(transport.lastMessage(connection), { jsonrpc: "2.0", id: 1, result: { ok: true } });

	await transport.emitRequest(connection, { id: 2, method: "control", params: { op: "save-now" } });
	assert.equal(fs.existsSync(savePath), true);
	assert.deepEqual(transport.lastMessage(connection), { jsonrpc: "2.0", id: 2, result: { ok: true } });

	await transport.emitRequest(connection, { id: 3, method: "control", params: { op: "set-speed", ticksPerSecond: -1 } });
	assert.equal(transport.lastMessage(connection).error?.code, RpcErrorCode.RuntimeError);

	transport.emitInvalidMessage(connection, "not json", new Error("Unexpected token"));
	assert.equal(transport.lastMessage(connection).error?.code, RpcErrorCode.ParseError);

	await transport.emitRequest(connection, { id: 4, method: "control", params: { op: "shutdown" } });
	await new Promise((resolve) => setImmediate(resolve));
	assert.deepEqual(transport.lastMessage(connection), { jsonrpc: "2.0", id: 4, result: { ok: true } });
	assert.equal(shutdownRequested, true);

	await server.close();
});
