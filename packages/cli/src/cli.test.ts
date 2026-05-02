import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";

import { runCli } from "./cli.js";

test("runCli rejects unknown commands with a help hint", async () => {
	await assert.rejects(() => runCli(["wat"]), /Run 'dct --help' for usage/);
});

test("dct --help prints the command list", async () => {
	const child = spawn(process.execPath, ["--import", "tsx", "bin/dct.js", "--help"], {
		cwd: process.cwd(),
		stdio: ["ignore", "pipe", "pipe"],
	});

	const stdout = await new Promise<string>((resolve, reject) => {
		let output = "";
		child.stdout?.on("data", (chunk) => {
			output += chunk.toString();
		});
		child.once("error", reject);
		child.once("close", (code) => {
			if (code !== 0) {
				reject(new Error(`help exited with code ${code}`));
				return;
			}
			resolve(output);
		});
	});

	assert.match(stdout, /Datacenter Tycoon CLI/);
	assert.match(stdout, /status\s+Print a game summary/);
	assert.match(stdout, /build-dc\s+Build a datacenter/);
	assert.match(stdout, /--json/);
});
