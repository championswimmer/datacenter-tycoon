import assert from "node:assert/strict";
import test from "node:test";

import { autocompletePaletteInput, splitCommandLine } from "./palette.js";

test("splitCommandLine splits whitespace and keeps quoted arguments together", () => {
	assert.deepEqual(splitCommandLine('load "my save.json" --json'), ["load", "my save.json", "--json"]);
});

test("autocompletePaletteInput completes unique command names", () => {
	assert.equal(autocompletePaletteInput("sta"), "status ");
	assert.equal(autocompletePaletteInput("s"), "s");
	assert.equal(autocompletePaletteInput("add-rack dc-1"), "add-rack dc-1");
});
