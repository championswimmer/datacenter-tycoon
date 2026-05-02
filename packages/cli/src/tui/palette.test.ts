import assert from "node:assert/strict";
import test from "node:test";

import { autocompletePaletteInput, splitCommandLine } from "./palette.js";

test("splitCommandLine splits whitespace and keeps quoted arguments together", () => {
	assert.deepEqual(splitCommandLine('load "my save.json" --json'), ["load", "my save.json", "--json"]);
	assert.deepEqual(splitCommandLine("build-dc 'new dc' --id dc-2"), ["build-dc", "new dc", "--id", "dc-2"]);
	assert.deepEqual(splitCommandLine("  leading  spaces   "), ["leading", "spaces"]);
	assert.deepEqual(splitCommandLine('unclosed "quote'), ["unclosed", "quote"]);
	assert.deepEqual(splitCommandLine(""), []);
});

test("autocompletePaletteInput completes unique command names", () => {
	assert.equal(autocompletePaletteInput("sta"), "status ");
	assert.equal(autocompletePaletteInput("s"), "s"); // matches status, save, speed - no unique match
	assert.equal(autocompletePaletteInput("add-rack dc-1"), "add-rack dc-1"); // already has space, ignores
	assert.equal(autocompletePaletteInput("  bu"), "  build-dc "); // preserves leading spaces but completes
	assert.equal(autocompletePaletteInput("does-not-exist"), "does-not-exist");
});
