import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";

import { formatJsonError, formatJsonResult, formatTextError } from "./commands/common.js";

test("formatJsonResult uses the standard ok/data envelope", () => {
	assert.equal(formatJsonResult({ tick: 1 }), JSON.stringify({ ok: true, data: { tick: 1 } }, null, 2));
});

test("formatJsonError uses the standard ok/error envelope", () => {
	assert.equal(formatJsonError("boom"), JSON.stringify({ ok: false, error: { code: 1, message: "boom" } }, null, 2));
});

test("formatJsonError preserves structured machine-readable error details", () => {
	const error = Object.assign(new Error("Datacenter dc-1 lacks available capacity for this contract"), {
		data: {
			code: "insufficient_capacity",
			dcId: "dc-1",
			required: { vCpu: 10, ramGb: 20, storageTb: 30, gpuFlops: 40 },
			available: { vCpu: 1, ramGb: 2, storageTb: 3, gpuFlops: 4 },
		},
	});

	assert.equal(
		formatJsonError(error),
		JSON.stringify(
			{
				ok: false,
				error: {
					code: "insufficient_capacity",
					dcId: "dc-1",
					required: { vCpu: 10, ramGb: 20, storageTb: 30, gpuFlops: 40 },
					available: { vCpu: 1, ramGb: 2, storageTb: 3, gpuFlops: 4 },
					message: "Datacenter dc-1 lacks available capacity for this contract",
				},
			},
			null,
			2,
		),
	);
});

test("formatTextError expands insufficient-capacity failures for humans", () => {
	const error = Object.assign(new Error("Datacenter dc-1 lacks available capacity for this contract"), {
		data: {
			code: "insufficient_capacity",
			dcId: "dc-1",
			required: { vCpu: 10, ramGb: 20, storageTb: 30, gpuFlops: 40 },
			available: { vCpu: 1, ramGb: 2, storageTb: 3, gpuFlops: 4 },
		},
	});

	assert.equal(
		formatTextError(error),
		"Cannot accept contract on dc-1: insufficient available capacity (required: vCPU=10, RAM=20GB, Storage=30TB, GPU=40; available: vCPU=1, RAM=2GB, Storage=3TB, GPU=4)",
	);
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
