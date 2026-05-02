import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

test("dct with no args lazy-loads the TUI and exits on q", async () => {
	const child = spawn(process.execPath, ["--import", "tsx", "src/cli.ts"], {
		cwd: process.cwd(),
		stdio: ["pipe", "pipe", "pipe"],
	});

	let stdout = "";
	child.stdout?.on("data", (chunk) => {
		stdout += chunk.toString();
	});

	await delay(100);
	child.stdin?.write("q");

	const exitCode = await new Promise<number>((resolve, reject) => {
		child.once("error", reject);
		child.once("close", (code) => resolve(code ?? 1));
	});

	assert.equal(exitCode, 0);
	assert.match(stdout, /Datacenter Tycoon/);
	assert.match(stdout, /Press q to quit/);
});
