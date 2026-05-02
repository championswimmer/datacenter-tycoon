import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawn } from "node:child_process";

function createTempPaths() {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "dct-cli-daemon-"));
	return {
		directory,
		savePath: path.join(directory, "save.json"),
		socketPath: path.join(directory, "dct.sock"),
	};
}

async function waitForSocket(socketPath: string, timeoutMs: number): Promise<void> {
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

	throw new Error(`Timed out waiting for socket ${socketPath}`);
}

test("cli daemon starts and cli quit shuts it down", async () => {
	const { savePath, socketPath } = createTempPaths();
	const child = spawn(process.execPath, ["--import", "tsx", "src/cli.ts", "daemon", "--save", savePath, "--socket", socketPath, "--idle-timeout", "5000"], {
		cwd: process.cwd(),
		stdio: "ignore",
	});

	await waitForSocket(socketPath, 4000);
	const quit = spawn(process.execPath, ["--import", "tsx", "src/cli.ts", "quit", "--save", savePath, "--socket", socketPath], {
		cwd: process.cwd(),
		stdio: "pipe",
	});

	const quitExitCode = await new Promise<number>((resolve, reject) => {
		quit.once("error", reject);
		quit.once("exit", (code) => resolve(code ?? 1));
	});
	assert.equal(quitExitCode, 0);

	const daemonExitCode = await new Promise<number>((resolve, reject) => {
		const timeout = setTimeout(() => {
			child.kill("SIGKILL");
			reject(new Error("Daemon did not exit in time"));
		}, 3000);
		child.once("error", (error) => {
			clearTimeout(timeout);
			reject(error);
		});
		child.once("exit", (code) => {
			clearTimeout(timeout);
			resolve(code ?? 1);
		});
	});

	assert.equal(daemonExitCode, 0);
	assert.equal(fs.existsSync(savePath), true);
});
