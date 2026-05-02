import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { newGame, serialize } from "@datacenter-tycoon/game-logic";

import { parseArgv } from "../argv.js";
import type { CommandClient } from "./common.js";
import { runLoadCommand, runNewCommand, runQuitCommand, runSaveCommand } from "./new-load.js";

function createTempPaths() {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "dct-cli-save-mgmt-"));
	return {
		directory,
		savePath: path.join(directory, "save.json"),
		socketPath: path.join(directory, "dct.sock"),
		importPath: path.join(directory, "import.json"),
		exportPath: path.join(directory, "export.json"),
	};
}

function createFakeClient(log: string[], snapshotTick = 0): CommandClient {
	return {
		connect: async () => {
			log.push("connect");
		},
		query: async (params) => {
			log.push(`query:${params.kind}`);
			return params.kind === "snapshot" ? { tick: snapshotTick } : { tick: snapshotTick };
		},
		control: async (params) => {
			log.push(`control:${params.op}`);
			return { ok: true };
		},
		close: async () => {
			log.push("close");
		},
	};
}

test("runNewCommand requires --yes before deleting and recreating the save", async () => {
	const { savePath, socketPath } = createTempPaths();
	await assert.rejects(() => runNewCommand(parseArgv(["new", "--save", savePath, "--socket", socketPath])), /--yes/);
});

test("runNewCommand recreates the save and reconnects to the daemon", async () => {
	const { savePath, socketPath } = createTempPaths();
	const log: string[] = [];
	const client = createFakeClient(log);

	await runNewCommand(parseArgv(["new", "--yes", "--seed", "42", "--save", savePath, "--socket", socketPath, "--quiet"]), () => client);

	assert.equal(fs.existsSync(savePath), true);
	assert.deepEqual(log, ["connect", "control:shutdown", "close", "connect", "query:status", "close"]);
	assert.match(fs.readFileSync(savePath, "utf8"), /"seed":42/);
});

test("runLoadCommand validates and copies a save before reconnecting", async () => {
	const { savePath, socketPath, importPath } = createTempPaths();
	const log: string[] = [];
	fs.writeFileSync(importPath, serialize(newGame(99)), "utf8");

	await runLoadCommand(parseArgv(["load", importPath, "--save", savePath, "--socket", socketPath, "--quiet"]), () => createFakeClient(log));

	assert.equal(fs.existsSync(savePath), true);
	assert.deepEqual(log, ["connect", "control:shutdown", "close", "connect", "query:status", "close"]);
	assert.match(fs.readFileSync(savePath, "utf8"), /"seed":99/);
});

test("runSaveCommand forces save-now and exports a copy when requested", async () => {
	const { savePath, socketPath, exportPath } = createTempPaths();
	const log: string[] = [];
	fs.writeFileSync(savePath, serialize(newGame(7)), "utf8");

	await runSaveCommand(
		parseArgv(["save", exportPath, "--save", savePath, "--socket", socketPath, "--quiet"]),
		() => createFakeClient(log, 12),
	);

	assert.deepEqual(log, ["connect", "control:save-now", "query:snapshot", "close"]);
	assert.equal(fs.existsSync(exportPath), true);
	assert.equal(fs.readFileSync(exportPath, "utf8"), fs.readFileSync(savePath, "utf8"));
});

test("runQuitCommand sends shutdown to the daemon", async () => {
	const { savePath, socketPath } = createTempPaths();
	const log: string[] = [];

	await runQuitCommand(parseArgv(["quit", "--save", savePath, "--socket", socketPath, "--quiet"]), () => createFakeClient(log));

	assert.deepEqual(log, ["connect", "control:shutdown", "close"]);
});
