import net from "node:net";
import path from "node:path";
import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { fileURLToPath } from "node:url";

import { resolvePaths } from "../paths.js";

export interface AutoSpawnOptions {
	socketPath: string;
	savePath?: string;
	noDaemon?: boolean;
	waitForSocketTimeoutMs?: number;
	idleTimeoutMs?: number;
	seed?: number;
	spawnProcess?: typeof spawn;
}

const DEFAULT_WAIT_FOR_SOCKET_TIMEOUT_MS = 3000;

function currentCliEntrypoint(): { scriptPath: string; useTsx: boolean } {
	const currentExtension = path.extname(fileURLToPath(import.meta.url));
	const scriptPath = fileURLToPath(new URL(`../cli${currentExtension}`, import.meta.url));
	return {
		scriptPath,
		useTsx: currentExtension === ".ts",
	};
}

export async function waitForSocket(socketPath: string, timeoutMs = DEFAULT_WAIT_FOR_SOCKET_TIMEOUT_MS): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			await new Promise<void>((resolve, reject) => {
				const socket = net.createConnection(socketPath);
				socket.once("connect", () => {
					socket.end();
					resolve();
				});
				socket.once("error", (error) => {
					socket.destroy();
					reject(error);
				});
			});
			return;
		} catch {
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
	}

	throw new Error(`Timed out waiting for daemon socket: ${socketPath}`);
}

export function spawnDaemon(options: AutoSpawnOptions): ChildProcess {
	const { scriptPath, useTsx } = currentCliEntrypoint();
	const resolvedPaths = resolvePaths({
		socketOverride: options.socketPath,
		saveOverride: options.savePath,
	});
	const daemonArgs = [scriptPath, "daemon", "--socket", resolvedPaths.socketPath, "--save", resolvedPaths.savePath];

	if (options.idleTimeoutMs !== undefined) {
		daemonArgs.push("--idle-timeout", String(options.idleTimeoutMs));
	}
	if (options.seed !== undefined) {
		daemonArgs.push("--seed", String(options.seed));
	}

	const commandArgs = useTsx ? ["--import", "tsx", ...daemonArgs] : daemonArgs;
	const spawnImpl = options.spawnProcess ?? spawn;
	const spawnOptions: SpawnOptions = {
		detached: true,
		stdio: "ignore",
	};

	const child = spawnImpl(process.execPath, commandArgs, spawnOptions);
	child.unref();
	return child;
}

export async function autoSpawnDaemon(options: AutoSpawnOptions): Promise<ChildProcess> {
	if (options.noDaemon) {
		throw new Error(`No daemon running at socket ${options.socketPath}`);
	}

	const child = spawnDaemon(options);
	await waitForSocket(options.socketPath, options.waitForSocketTimeoutMs);
	return child;
}
