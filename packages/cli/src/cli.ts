import net from "node:net";

import { formatHelp, getFlagValue, hasHelpFlag, parseArgv, type CommandDefinition } from "./argv.js";
import { runStatusCommand } from "./commands/status.js";
import { GamePersistence, loadOrInit } from "./daemon/persist.js";
import { GameRuntime } from "./daemon/runtime.js";
import { GameDaemonServer } from "./daemon/server.js";
import { DaemonLifecycle, waitForExit } from "./daemon/lifecycle.js";
import { DaemonTransport } from "./daemon/transport.js";
import { resolvePaths } from "./paths.js";

interface CommandContext {
	parsed: ReturnType<typeof parseArgv>;
}

interface CommandHandler extends CommandDefinition {
	run: (context: CommandContext) => Promise<void>;
}

function getStringFlag(parsed: ReturnType<typeof parseArgv>, flag: string): string | undefined {
	const value = getFlagValue(parsed, flag);
	return typeof value === "string" ? value : undefined;
}

function getNumericFlag(parsed: ReturnType<typeof parseArgv>, flag: string, fallback: number): number {
	const value = getStringFlag(parsed, flag);
	if (!value) {
		return fallback;
	}

	const parsedNumber = Number(value);
	if (!Number.isFinite(parsedNumber)) {
		throw new Error(`Invalid value for ${flag}: ${value}`);
	}

	return parsedNumber;
}

async function runDaemon(parsed: ReturnType<typeof parseArgv>): Promise<void> {
	const paths = resolvePaths({
		saveOverride: getStringFlag(parsed, "--save"),
		socketOverride: getStringFlag(parsed, "--socket"),
	});
	const persistence = new GamePersistence({ savePath: paths.savePath });
	const runtime = new GameRuntime({ state: loadOrInit(paths.savePath, getNumericFlag(parsed, "--seed", 1)) });
	const transport = new DaemonTransport({ socketPath: paths.socketPath });
	const server = new GameDaemonServer({
		transport,
		runtime,
		persistence,
	});
	const lifecycle = new DaemonLifecycle({
		pidPath: paths.pidPath,
		idleTimeoutMs: getNumericFlag(parsed, "--idle-timeout", 10 * 60 * 1000),
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

async function runQuit(parsed: ReturnType<typeof parseArgv>): Promise<void> {
	const { socketPath } = resolvePaths({
		saveOverride: getStringFlag(parsed, "--save"),
		socketOverride: getStringFlag(parsed, "--socket"),
	});

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

function createNotImplementedHandler(name: string, summary: string): CommandHandler {
	return {
		name,
		summary,
		run: async () => {
			throw new Error(`Command not implemented yet: ${name}`);
		},
	};
}

const COMMANDS: CommandHandler[] = [
	{ name: "daemon", summary: "Run the background game daemon", run: async ({ parsed }) => runDaemon(parsed) },
	{ name: "status", summary: "Print a game summary", run: async ({ parsed }) => runStatusCommand(parsed) },
	createNotImplementedHandler("new", "Create a new save"),
	createNotImplementedHandler("load", "Load a savefile into the daemon state"),
	createNotImplementedHandler("save", "Force-save the current game"),
	{ name: "quit", summary: "Flush state and shut down the daemon", run: async ({ parsed }) => runQuit(parsed) },
	createNotImplementedHandler("ls", "List datacenters, racks, contracts, or catalog data"),
	createNotImplementedHandler("build-dc", "Build a datacenter"),
	createNotImplementedHandler("add-rack", "Add a rack to a datacenter"),
	createNotImplementedHandler("remove-rack", "Remove a rack placement"),
	createNotImplementedHandler("accept-contract", "Accept a contract"),
	createNotImplementedHandler("cancel-contract", "Cancel an active contract"),
	createNotImplementedHandler("tick", "Advance one or more ticks"),
	createNotImplementedHandler("pause", "Pause the daemon tick loop"),
	createNotImplementedHandler("resume", "Resume the daemon tick loop"),
	createNotImplementedHandler("speed", "Set daemon tick speed"),
];

const COMMAND_MAP = new Map(COMMANDS.map((command) => [command.name, command]));

export async function runCli(args: string[]): Promise<void> {
	const parsed = parseArgv(args);

	if (parsed.command === "help" || hasHelpFlag(parsed)) {
		console.log(formatHelp(COMMANDS));
		return;
	}

	if (!parsed.command) {
		console.log("dct");
		return;
	}

	const command = COMMAND_MAP.get(parsed.command);
	if (!command) {
		throw new Error(`Unknown command: ${parsed.command}. Run 'dct --help' for usage.`);
	}

	await command.run({ parsed });
}

async function main(): Promise<void> {
	await runCli(process.argv.slice(2));
}

void main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
