import { test, expect } from "@microsoft/tui-test";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test.use({ program: { file: "node", args: ["--import", "tsx", resolve(process.cwd(), "bin/dct.js")] } });

test("Prototype testing TUI", async ({ terminal }) => {
	// Wait for the TUI to render its initial state (Dashboard tab)
	await expect(terminal.getByText("Dashboard", { strict: false })).toBeVisible();
	await expect(terminal.getByText("Cash:", { strict: false })).toBeVisible();

	// Navigate to Datacenters tab
	terminal.write("2");
	await expect(terminal.getByText("Datacenters", { strict: false })).toBeVisible();

	// Navigate to Contracts tab
	terminal.write("3");
	await expect(terminal.getByText("Contracts", { strict: false })).toBeVisible();

	// Send 'q' key to quit
	terminal.write("q");

	// Wait for the terminal process to exit
	await new Promise((r) => setTimeout(r, 1000));
});

test("TUI responsive design (snapshots)", async ({ terminal }) => {
	// Wait for the TUI to render its initial state
	await expect(terminal.getByText("Dashboard", { strict: false })).toBeVisible();

	// Resize to a small terminal
	terminal.resize(60, 20);
	await new Promise((r) => setTimeout(r, 500)); // Wait for render
	await expect(terminal).toMatchSnapshot();

	// Resize to a larger terminal
	terminal.resize(100, 30);
	await new Promise((r) => setTimeout(r, 500)); // Wait for render
	await expect(terminal).toMatchSnapshot();

	terminal.write("q");
	await new Promise((r) => setTimeout(r, 1000));
});
