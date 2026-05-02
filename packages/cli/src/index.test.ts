import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawn } from "node:child_process";

import { loadOrInit } from "./daemon/persist.js";

function createTempPaths() {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "dct-cli-integration-"));
	return {
		directory,
		savePath: path.join(directory, "save.json"),
		socketPath: path.join(directory, "dct.sock"),
	};
}

async function runCli(args: string[]): Promise<{ stdout: string; stderr: string }> {
	const child = spawn(process.execPath, ["--import", "tsx", "src/cli.ts", ...args], {
		cwd: process.cwd(),
		stdio: ["ignore", "pipe", "pipe"],
	});

	return await new Promise((resolve, reject) => {
		let stdout = "";
		let stderr = "";
		child.stdout?.on("data", (chunk) => {
			stdout += chunk.toString();
		});
		child.stderr?.on("data", (chunk) => {
			stderr += chunk.toString();
		});
		child.once("error", reject);
		child.once("close", (code) => {
			if (code !== 0) {
				reject(new Error(`cli exited with code ${code}: ${stderr}`));
				return;
			}
			resolve({ stdout, stderr });
		});
	});
}

test("cli integration flow can create, mutate, tick, and save a game", async () => {
	const { savePath, socketPath } = createTempPaths();
	const scoped = (args: string[]) => [...args, "--save", savePath, "--socket", socketPath, "--json"];

	await runCli(scoped(["new", "--yes", "--seed", "7"]));
	await runCli(scoped(["build-dc", "garage", "--id", "dc-1"]));
	await runCli(scoped(["add-rack", "dc-1", "0", "0", "C1", "--id", "rp-1"]));
	await runCli(scoped(["tick", "10"]));
	const statusResult = await runCli(scoped(["status"]));

	const statusJson = JSON.parse(statusResult.stdout) as { ok: boolean; data: { tick: number; datacenterCount: number; rackCount: number } };
	assert.equal(statusJson.ok, true);
	assert.equal(statusJson.data.tick, 10);
	assert.equal(statusJson.data.datacenterCount, 1);
	assert.equal(statusJson.data.rackCount, 1);

	await runCli(scoped(["quit"]));

	const state = loadOrInit(savePath, 999);
	assert.equal(state.seed, 7);
	assert.equal(state.tick, 10);
	assert.equal(state.datacenters.length, 1);
	assert.equal(state.datacenters[0]?.id, "dc-1");
	assert.equal(state.datacenters[0]?.placements[0]?.id, "rp-1");
});
