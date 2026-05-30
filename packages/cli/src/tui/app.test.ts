import assert from "node:assert/strict";
import test from "node:test";

import { parseArgv } from "../argv.js";
import { buildPaletteCommandArgs } from "./app.js";

test("buildPaletteCommandArgs inherits the selected game and global server override into palette commands", () => {
	const args = buildPaletteCommandArgs("tick 1", {
		parsed: parseArgv(["--server", "http://127.0.0.1:3000", "--save", "/tmp/dct/save.json"]),
		selectedGameId: "game-123",
	});

	assert.deepEqual(args, [
		"tick",
		"1",
		"--game-id",
		"game-123",
		"--server",
		"http://127.0.0.1:3000",
		"--save",
		"/tmp/dct/save.json",
	]);
});

test("buildPaletteCommandArgs does not duplicate explicit palette flags", () => {
	const args = buildPaletteCommandArgs("tick 1 --game-id override --server http://override.test", {
		parsed: parseArgv(["--server", "http://127.0.0.1:3000", "--save", "/tmp/dct/save.json"]),
		selectedGameId: "game-123",
	});

	assert.deepEqual(args, [
		"tick",
		"1",
		"--game-id",
		"override",
		"--server",
		"http://override.test",
		"--save",
		"/tmp/dct/save.json",
	]);
});
