import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { EventEmitter } from "node:events";

import { newGame } from "@datacenter-tycoon/game-logic";

import { DaemonLifecycle } from "./lifecycle.js";
import { GameRuntime } from "./runtime.js";

class FakeTransport extends EventEmitter<{ connection: [unknown]; disconnect: [unknown] }> {}

class FakeSignalProcess {
	pid = 4242;
	readonly emitter = new EventEmitter<{ SIGINT: []; SIGTERM: [] }>();
	readonly alivePids = new Set<number>();

	on(event: NodeJS.Signals, listener: () => void): void {
		this.emitter.on(event, listener);
	}

	off(event: NodeJS.Signals, listener: () => void): void {
		this.emitter.off(event, listener);
	}

	kill(pid: number): boolean {
		if (this.alivePids.has(pid)) {
			return true;
		}

		const error = new Error("No such process") as NodeJS.ErrnoException;
		error.code = "ESRCH";
		throw error;
	}

	emitSignal(signal: "SIGINT" | "SIGTERM"): void {
		this.emitter.emit(signal);
	}
}

function createPidPath(): string {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "dct-cli-lifecycle-"));
	return path.join(directory, "dct.pid");
}

test("DaemonLifecycle acquires and releases pid locks", async () => {
	const transport = new FakeTransport();
	const signalProcess = new FakeSignalProcess();
	let started = 0;
	let stopped = 0;
	const lifecycle = new DaemonLifecycle({
		pidPath: createPidPath(),
		transport,
		runtime: new GameRuntime({ state: newGame(1), paused: true }),
		startServer: async () => {
			started += 1;
		},
		stopServer: async () => {
			stopped += 1;
		},
		signalProcess,
	});

	await lifecycle.start();
	assert.equal(started, 1);
	assert.equal(fs.existsSync((lifecycle as unknown as { pidPath: string }).pidPath), true);

	await lifecycle.requestShutdown();
	assert.equal(stopped, 1);
	assert.equal(fs.existsSync((lifecycle as unknown as { pidPath: string }).pidPath), false);
});

test("DaemonLifecycle rejects live pid locks and allows stale ones", async () => {
	const transport = new FakeTransport();
	const signalProcess = new FakeSignalProcess();
	const pidPath = createPidPath();
	fs.writeFileSync(pidPath, "9999\n", "utf8");
	const runtime = new GameRuntime({ state: newGame(2), paused: true });

	signalProcess.alivePids.add(9999);
	const runningLockLifecycle = new DaemonLifecycle({
		pidPath,
		transport,
		runtime,
		startServer: async () => {},
		stopServer: async () => {},
		signalProcess,
	});
	await assert.rejects(() => runningLockLifecycle.start(), /Daemon already running/);

	signalProcess.alivePids.delete(9999);
	const staleLockLifecycle = new DaemonLifecycle({
		pidPath,
		transport,
		runtime,
		startServer: async () => {},
		stopServer: async () => {},
		signalProcess,
	});
	await staleLockLifecycle.start();
	await staleLockLifecycle.requestShutdown();
});

test("DaemonLifecycle exits after idle timeout when paused and no clients remain", async () => {
	const transport = new FakeTransport();
	const signalProcess = new FakeSignalProcess();
	let exitedCode: number | undefined;
	const lifecycle = new DaemonLifecycle({
		pidPath: createPidPath(),
		idleTimeoutMs: 20,
		transport,
		runtime: new GameRuntime({ state: newGame(3), paused: true }),
		startServer: async () => {},
		stopServer: async () => {},
		exit: (code) => {
			exitedCode = code;
		},
		signalProcess,
	});

	await lifecycle.start();
	await new Promise((resolve) => setTimeout(resolve, 40));
	assert.equal(exitedCode, 0);
});

test("DaemonLifecycle resets idle timer on connections and signal shutdown", async () => {
	const transport = new FakeTransport();
	const signalProcess = new FakeSignalProcess();
	let stopped = 0;
	let exitCode: number | undefined;
	const lifecycle = new DaemonLifecycle({
		pidPath: createPidPath(),
		idleTimeoutMs: 20,
		transport,
		runtime: new GameRuntime({ state: newGame(4), paused: true }),
		startServer: async () => {},
		stopServer: async () => {
			stopped += 1;
		},
		exit: (code) => {
			exitCode = code;
		},
		signalProcess,
	});

	await lifecycle.start();
	transport.emit("connection", {});
	await new Promise((resolve) => setTimeout(resolve, 30));
	assert.equal(exitCode, undefined);

	transport.emit("disconnect", {});
	signalProcess.emitSignal("SIGTERM");
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(stopped, 1);
	assert.equal(exitCode, 0);
});
