import assert from "node:assert/strict";
import test from "node:test";

import { renderLayout } from "./layout.js";
import { renderToMetadata } from "./test-utils.js";

test("renderLayout prints the shell with header, tabs, body, and status line", (t) => {
	const rendered = renderLayout({
		tick: 42,
		cash: 125000,
		difficulty: "easy",
		speedTps: 4,
		paused: false,
		activeTab: "dashboard",
		bodyLines: ["Overview", "Line 2"],
		statusLine: ": help",
		showHelp: false,
	});

	assert.match(rendered, /Datacenter Tycoon  tick 42  cash \$125,000  mode EASY  speed 4x/);
	assert.match(rendered, /\[1 Dashboard\]/);
	assert.match(rendered, /2 DCs/);
	assert.match(rendered, /Overview/);
	assert.match(rendered, /: help/);

	t.assert.snapshot(renderToMetadata(rendered));
});
