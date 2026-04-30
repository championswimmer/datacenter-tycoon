import { test } from "node:test";
import assert from "node:assert/strict";
import { VERSION } from "./index.js";

test("hello world: game-logic exposes VERSION", () => {
	assert.equal(typeof VERSION, "string");
	assert.match(VERSION, /^\d+\.\d+\.\d+$/);
});
