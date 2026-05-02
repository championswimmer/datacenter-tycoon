import net from "node:net";

import { GamePersistence, loadOrInit } from "./daemon/persist.js";
import { GameRuntime } from "./daemon/runtime.js";
import { GameDaemonServer } from "./daemon/server.js";
import { DaemonLifecycle, waitForExit } from "./daemon/lifecycle.js";
import { DaemonTransport } from "./daemon/transport.js";
import { resolvePaths } from "./paths.js";

function getFlagValue(args: string[], flag: string): string | undefined {
	const inline = args.find((arg) => arg.startsWith(`${flag}=`));
	if (inline) {
		return inline.slice(flag.length + 1);
	}

	const index = args.indexOf(flag);
	if (index >= 0) {
		return args[index + 1];
	}

	return undefined;
}

function getNumericFlagValue(args: string[], flag: string, fallback: number): number {
	const value = getFlagValue(args, flag);
	if (!value) {
		return fallback;
	}

	const parsed = Number(value);
	if (!Number.isFinite(parsed)) {
		throw new Error(`Invalid value for ${flag}: ${value}`);
	}

	return parsed;
}

async function runDaemon(args: string[]): Promise<void> {
	const saveOverride = getFlagValue(args, "--save");
	const socketOverride = getFlagValue(args, "--socket");
	const seed = getNumericFlagValue(args, "--seed", 1);
	const idleTimeoutMs = getNumericFlagValue(args, "--idle-timeout", 10 * 60 * 1000);
	const paths = resolvePaths({ saveOverride, socketOverride });
	const persistence = new GamePersistence({ savePath: paths.savePath });
	const runtime = new GameRuntime({ state: loadOrInit(paths.savePath, seed) });
	const transport = new DaemonTransport({ socketPath: paths.socketPath });
	const server = new GameDaemonServer({
		transport,
		runtime,
		persistence,
	});
	const lifecycle = new DaemonLifecycle({
		pidPath: paths.pidPath,
		idleTimeoutMs,
		transport,
		runtime,
		startServer: () => server.start(),
		stopServer: () => server.close(),
		exit: (code) => {
			process.exit(code);
		},
	});

	server.on("shutdownRequested", () => {
		void lifecycle.requestShutdown(0);
	});

	await lifecycle.start();
	await waitForExit(lifecycle);
}

async function runQuit(args: string[]): Promise<void> {
	const saveOverride = getFlagValue(args, "--save");
	const socketOverride = getFlagValue(args, "--socket");
	const { socketPath } = resolvePaths({ saveOverride, socketOverride });

	await new Promise<void>((resolve, reject) => {
		const socket = net.createConnection(socketPath);
		let buffer = "";
		socket.on("connect", () => {
			socket.write('{"jsonrpc":"2.0","id":1,"method":"control","params":{"op":"shutdown"}}\n');
		});
		socket.on("data", (chunk) => {
			buffer += chunk.toString();
			const newlineIndex = buffer.indexOf("\n");
			if (newlineIndex < 0) {
				return;
			}

			const line = buffer.slice(0, newlineIndex);
			const response = JSON.parse(line) as { error?: { message: string } };
			socket.end();
			if (response.error) {
				reject(new Error(response.error.message));
				return;
			}
			resolve();
		});
		socket.on("error", (error) => {
			reject(error);
		});
	});
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const command = args[0];

	if (command === "daemon") {
		await runDaemon(args.slice(1));
		return;
	}

	if (command === "quit") {
		await runQuit(args.slice(1));
		return;
	}

	console.log("dct");
}

void main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
