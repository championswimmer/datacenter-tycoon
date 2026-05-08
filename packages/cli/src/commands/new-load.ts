import fs from "node:fs";

import { deserialize, newGame, serialize } from "@datacenter-tycoon/game-logic";

import type { ParsedArgv } from "../argv.js";
import { DctClient } from "../client/client.js";
import {
	bestEffortShutdown,
	copyStateFile,
	createCommandClientOptions,
	getNumberFlag,
	hasBooleanFlag,
	requirePositional,
	resolveCommandPaths,
	waitForDaemonShutdown,
	writeCommandResult,
	writeStateFile,
	withClient,
	type CommandClientFactory,
} from "./common.js";

export async function runNewCommand(
	parsed: ParsedArgv,
	clientFactory?: CommandClientFactory,
): Promise<void> {
	if (!hasBooleanFlag(parsed, "--yes")) {
		throw new Error("dct new is destructive. Re-run with --yes to confirm.");
	}

	const paths = resolveCommandPaths(parsed);
	await bestEffortShutdown(parsed, clientFactory);
	if (fs.existsSync(paths.savePath)) {
		fs.rmSync(paths.savePath, { force: true });
	}

	const seed = getNumberFlag(parsed, "--seed", 1);
	writeStateFile(paths.savePath, serialize(newGame(seed)));

	await withClient(
		parsed,
		async (client) => {
			await client.query({ kind: "status" });
		},
		clientFactory,
	);

	writeCommandResult(parsed, `Created a new game at ${paths.savePath}`, {
		savePath: paths.savePath,
		seed,
	});
}

export async function runLoadCommand(
	parsed: ParsedArgv,
	clientFactory?: CommandClientFactory,
): Promise<void> {
	const importPath = requirePositional(parsed, 0, "dct load <path>");
	const sourceContent = fs.readFileSync(importPath, "utf8");
	const validatedState = deserialize(sourceContent);
	const paths = resolveCommandPaths(parsed);
	await bestEffortShutdown(parsed, clientFactory);
	writeStateFile(paths.savePath, serialize(validatedState));

	await withClient(
		parsed,
		async (client) => {
			await client.query({ kind: "status" });
		},
		clientFactory,
	);

	writeCommandResult(parsed, `Loaded save from ${importPath}`, {
		from: importPath,
		savePath: paths.savePath,
		tick: validatedState.tick,
	});
}

export async function runSaveCommand(
	parsed: ParsedArgv,
	clientFactory: CommandClientFactory = (options) => new DctClient(options),
): Promise<void> {
	const exportPath = parsed.positionals[0];
	const paths = resolveCommandPaths(parsed);

	const snapshot = await withClient(
		parsed,
		async (client) => {
			await client.control({ op: "save-now" });
			return await client.query({ kind: "snapshot" });
		},
		clientFactory,
	);

	if (exportPath) {
		copyStateFile(paths.savePath, exportPath);
	}

	writeCommandResult(parsed, exportPath ? `Saved game and exported to ${exportPath}` : `Saved game to ${paths.savePath}`, {
		savePath: paths.savePath,
		exportPath,
		snapshot,
	});
}

export async function runQuitCommand(
	parsed: ParsedArgv,
	clientFactory?: CommandClientFactory,
): Promise<void> {
	const paths = resolveCommandPaths(parsed);
	await withClient(
		parsed,
		async (client) => {
			await client.control({ op: "shutdown" });
		},
		clientFactory,
	);
	await waitForDaemonShutdown(paths);
	writeCommandResult(parsed, "Daemon shutdown requested", { ok: true });
}

export function createDefaultClientFactory(): CommandClientFactory {
	return (options) => new DctClient(options);
}

export function createClientOptionsForTests(parsed: ParsedArgv) {
	return createCommandClientOptions(parsed);
}
