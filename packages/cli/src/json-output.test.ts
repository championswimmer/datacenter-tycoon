import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";

import { formatJsonError, formatJsonResult } from "./commands/common.js";

test("formatJsonResult uses the standard ok/data envelope", () => {
	assert.equal(formatJsonResult({ tick: 1 }), JSON.stringify({ ok: true, data: { tick: 1 } }, null, 2));
});

test("formatJsonError uses the standard ok/error envelope", () => {
	assert.equal(formatJsonError("boom"), JSON.stringify({ ok: false, error: { code: 1, message: "boom" } }, null, 2));
});

test("cli prints JSON errors when --json is set", async () => {
	const child = spawn(process.execPath, ["--import", "tsx", "src/cli.ts", "speed", "--json"], {
		cwd: process.cwd(),
		stdio: ["ignore", "pipe", "pipe"],
	});

	const stderr = await new Promise<string>((resolve, reject) => {
		let output = "";
		child.stderr?.on("data", (chunk) => {
			output += chunk.toString();
		});
		child.once("error", reject);
		child.once("close", (code) => {
			if (code === 0) {
				reject(new Error("expected non-zero exit"));
				return;
			}
			resolve(output.trim());
		});
	});

	assert.match(stderr, /"ok": false/);
	assert.match(stderr, /Usage: dct speed/);
});
