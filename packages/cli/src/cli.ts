import net from "node:net";

import { formatHelp, getFlagValue, hasHelpFlag, parseArgv, type CommandDefinition } from "./argv.js";
import { runStatusCommand } from "./commands/status.js";
import { runLoadCommand, runNewCommand, runQuitCommand, runSaveCommand } from "./commands/new-load.js";
import { runLsCommand, runLsContractsCommand } from "./commands/ls.js";
import { runAddRackCommand, runBuildDatacenterCommand, runMoveRackCommand, runRemoveRackCommand } from "./commands/build-dc.js";
import { runAcceptContractCommand, runCancelContractCommand } from "./commands/contracts.js";
import { runQueryCommand } from "./commands/query.js";
import { formatJsonError } from "./commands/common.js";
import { runPauseCommand, runResumeCommand, runSpeedCommand } from "./commands/control.js";
import { runTickCommand } from "./commands/tick.js";
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
		gameId: getStringFlag(parsed, "--game-id") ?? getStringFlag(parsed, "--id"),
		socketOverride: getStringFlag(parsed, "--socket"),
	});
	const persistence = new GamePersistence({ savePath: paths.savePath });
	const initialState = loadOrInit(paths.savePath, getNumericFlag(parsed, "--seed", 1));
	const runtime = new GameRuntime({ state: initialState, paused: initialState.game.paused });
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
	{ name: "new", summary: "Create a new save", run: async ({ parsed }) => runNewCommand(parsed) },
	{ name: "load", summary: "Load a savefile into the daemon state", run: async ({ parsed }) => runLoadCommand(parsed) },
	{ name: "save", summary: "Force-save the current game", run: async ({ parsed }) => runSaveCommand(parsed) },
	{ name: "quit", summary: "Flush state and shut down the daemon", run: async ({ parsed }) => runQuitCommand(parsed) },
	{ name: "contracts", summary: "List market and active contracts with requirements", run: async ({ parsed }) => runLsContractsCommand(parsed) },
	{ name: "ls", summary: "List datacenters, racks, contracts, or catalog data", run: async ({ parsed }) => runLsCommand(parsed) },
	{ name: "build-dc", summary: "Build a datacenter", run: async ({ parsed }) => runBuildDatacenterCommand(parsed) },
	{ name: "add-rack", summary: "Add a rack to a datacenter", run: async ({ parsed }) => runAddRackCommand(parsed) },
	{ name: "remove-rack", summary: "Remove a rack placement", run: async ({ parsed }) => runRemoveRackCommand(parsed) },
	{ name: "move-rack", summary: "Move a rack to another datacenter", run: async ({ parsed }) => runMoveRackCommand(parsed) },
	{ name: "accept-contract", summary: "Accept a contract", run: async ({ parsed }) => runAcceptContractCommand(parsed) },
	{ name: "cancel-contract", summary: "Cancel an active contract", run: async ({ parsed }) => runCancelContractCommand(parsed) },
	{ name: "query", summary: "Execute a raw protocol query (JSON)", run: async ({ parsed }) => runQueryCommand(parsed) },
	{ name: "tick", summary: "Advance one or more ticks", run: async ({ parsed }) => runTickCommand(parsed) },
	{ name: "pause", summary: "Pause the daemon tick loop", run: async ({ parsed }) => runPauseCommand(parsed) },
	{ name: "resume", summary: "Resume the daemon tick loop", run: async ({ parsed }) => runResumeCommand(parsed) },
	{ name: "speed", summary: "Set daemon tick speed", run: async ({ parsed }) => runSpeedCommand(parsed) },
];

const COMMAND_MAP = new Map(COMMANDS.map((command) => [command.name, command]));

export async function runCli(args: string[]): Promise<void> {
	const parsed = parseArgv(args);

	if (parsed.command === "help" || hasHelpFlag(parsed)) {
		console.log(formatHelp(COMMANDS));
		return;
	}

	if (!parsed.command) {
		const { runTui } = await import("./tui/app.js");
		await runTui();
		return;
	}

	const command = COMMAND_MAP.get(parsed.command);
	if (!command) {
		throw new Error(`Unknown command: ${parsed.command}. Run 'dct --help' for usage.`);
	}

	await command.run({ parsed });
}

export async function main(): Promise<void> {
	try {
		await runCli(process.argv.slice(2));
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const parsed = parseArgv(process.argv.slice(2));
		if (parsed.flags["--json"] === true) {
			console.error(formatJsonError(message));
		} else {
			console.error(message);
		}
		process.exit(1);
	}
}

import { fileURLToPath } from "node:url";
if (import.meta.url.startsWith("file:") && process.argv[1] === fileURLToPath(import.meta.url)) {
	void main();
}

