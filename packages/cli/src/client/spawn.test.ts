import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { DctClient } from "./client.js";

function createTempPaths() {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "dct-cli-client-spawn-"));
	return {
		directory,
		savePath: path.join(directory, "save.json"),
		socketPath: path.join(directory, "dct.sock"),
	};
}

async function waitForProcessExit(pid: number, timeoutMs: number): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			process.kill(pid, 0);
			await new Promise((resolve) => setTimeout(resolve, 50));
		} catch (error) {
			const maybeError = error as NodeJS.ErrnoException;
			if (maybeError.code === "ESRCH") {
				return;
			}
			throw error;
		}
	}

	throw new Error(`Timed out waiting for process ${pid} to exit`);
}

test("DctClient auto-spawns a daemon when none is running", async () => {
	const { savePath, socketPath } = createTempPaths();
	const client = new DctClient({
		socketPath,
		savePath,
		waitForSocketTimeoutMs: 4000,
		idleTimeoutMs: 5000,
	});

	let spawnedPid: number | undefined;
	try {
		await client.connect();
		const spawnedProcess = client.getSpawnedProcess();
		spawnedPid = spawnedProcess?.pid;
		assert.ok(spawnedPid);
		assert.doesNotThrow(() => process.kill(spawnedPid!, 0));

		const hello = await client.hello({ clientVersion: "test" });
		assert.equal(hello.tick, 0);

		await client.control({ op: "save-now" });
		assert.equal(fs.existsSync(savePath), true);

		await client.control({ op: "shutdown" });
		await waitForProcessExit(spawnedPid!, 4000);
	} finally {
		await client.close();
		if (spawnedPid !== undefined) {
			try {
				process.kill(spawnedPid, 0);
				process.kill(spawnedPid, "SIGKILL");
			} catch {
				// process already exited
			}
		}
	}
});

test("DctClient respects noDaemon and fails instead of auto-spawning", async () => {
	const { savePath, socketPath } = createTempPaths();
	const client = new DctClient({
		socketPath,
		savePath,
		noDaemon: true,
	});

	await assert.rejects(() => client.connect(), /No daemon running/);
});
