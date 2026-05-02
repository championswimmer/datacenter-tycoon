import type { GameState } from "@datacenter-tycoon/game-logic";
import readline from "node:readline";

import { DctClient } from "../client/client.js";
import { resolvePaths } from "../paths.js";
import type { StatusView } from "../protocol/messages.js";
import { renderLayout, type TuiTabId } from "./layout.js";
import { renderDashboardTab } from "./tabs/dashboard.js";
import { renderDatacentersTab } from "./tabs/datacenters.js";
import { renderContractsTab } from "./tabs/contracts.js";

function getBodyLines(snapshot: GameState | undefined, activeTab: TuiTabId, selectedDatacenterIndex: number): string[] {
	if (!snapshot) {
		return ["Loading terminal UI...", "", "Press q to quit."];
	}

	if (activeTab === "dashboard") {
		return renderDashboardTab(snapshot);
	}

	if (activeTab === "datacenters") {
		return renderDatacentersTab(snapshot, selectedDatacenterIndex);
	}

	if (activeTab === "contracts") {
		return renderContractsTab(snapshot);
	}

	return ["Catalog", "", "Catalog tab coming up next..."];
}

function renderFrame(
	snapshot: GameState | undefined,
	status: StatusView | undefined,
	activeTab: TuiTabId,
	selectedDatacenterIndex: number,
): string {
	return renderLayout({
		tick: status?.tick ?? snapshot?.tick ?? 0,
		cash: status?.cash ?? snapshot?.player.cash ?? 0,
		speedTps: status?.speedTps ?? 0,
		paused: status?.paused ?? true,
		activeTab,
		bodyLines: getBodyLines(snapshot, activeTab, selectedDatacenterIndex),
		statusLine: "q quit · 1 dashboard · 2 dcs · 3 contracts · 4 catalog · ↑↓ select",
	});
}

export async function runTui(): Promise<void> {
	const stdin = process.stdin;
	const stdout = process.stdout;
	const wasRaw = stdin.isRaw;
	let activeTab: TuiTabId = "dashboard";
	let selectedDatacenterIndex = 0;

	if (!stdin.isTTY || !stdout.isTTY) {
		stdout.write(renderFrame(undefined, undefined, activeTab, selectedDatacenterIndex));
		return;
	}

	const paths = resolvePaths();
	const client = new DctClient({ socketPath: paths.socketPath, savePath: paths.savePath });
	let snapshot: GameState | undefined;
	let status: StatusView | undefined;
	try {
		await client.connect();
		status = (await client.query({ kind: "status" })) as StatusView;
		snapshot = (await client.query({ kind: "snapshot" })) as GameState;
	} catch {
		// Render loading shell even if connect fails for now.
	}

	const render = () => {
		stdout.write(`\u001B[2J\u001B[H\u001B[?1049h\n${renderFrame(snapshot, status, activeTab, selectedDatacenterIndex)}`);
	};

	readline.emitKeypressEvents(stdin);
	stdin.setRawMode(true);
	stdin.resume();
	render();

	const subscription = snapshot
		? await client.subscribeState(
				(nextSnapshot) => {
					snapshot = nextSnapshot;
				},
				() => {
					render();
				},
			)
		: undefined;

	await new Promise<void>((resolve) => {
		const cleanup = () => {
			stdin.off("keypress", onKeypress);
			stdin.off("data", onData);
		};
		const onKeypress = (_value: string, key: readline.Key) => {
			if (key.name === "q" || (key.ctrl && key.name === "c")) {
				cleanup();
				resolve();
				return;
			}
			if (key.name === "1") activeTab = "dashboard";
			if (key.name === "2") activeTab = "datacenters";
			if (key.name === "3") activeTab = "contracts";
			if (key.name === "4") activeTab = "catalog";
			if (activeTab === "datacenters" && key.name === "up") {
				selectedDatacenterIndex = Math.max(0, selectedDatacenterIndex - 1);
			}
			if (activeTab === "datacenters" && key.name === "down") {
				selectedDatacenterIndex = Math.min((snapshot?.datacenters.length ?? 1) - 1, selectedDatacenterIndex + 1);
			}
			render();
		};
		const onData = (chunk: Buffer | string) => {
			const value = chunk.toString();
			if (value.includes("q") || value.includes("\u0003")) {
				cleanup();
				resolve();
			}
		};
		stdin.on("keypress", onKeypress);
		stdin.on("data", onData);
	});

	await subscription?.unsubscribe().catch(() => undefined);
	await client.close().catch(() => undefined);
	stdout.write("\u001B[?1049l\u001B[2J\u001B[H");
	stdin.setRawMode(Boolean(wasRaw));
	stdin.pause();
}
