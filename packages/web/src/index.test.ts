import { test } from "node:test";
import assert from "node:assert/strict";

test("hello world: web test runner works", () => {
	assert.equal("hello".toUpperCase(), "HELLO");
});
