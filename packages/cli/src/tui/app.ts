import type { GameState } from "@datacenter-tycoon/game-logic";
import readline from "node:readline";

import { DctClient } from "../client/client.js";
import { resolvePaths } from "../paths.js";
import type { StatusView } from "../protocol/messages.js";
import { renderLayout, type TuiTabId } from "./layout.js";
import { autocompletePaletteInput, splitCommandLine } from "./palette.js";
import { renderCatalogTab } from "./tabs/catalog.js";
import { renderContractsTab } from "./tabs/contracts.js";
import { renderDashboardTab } from "./tabs/dashboard.js";
import { renderDatacentersTab } from "./tabs/datacenters.js";

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

	return renderCatalogTab();
}

function renderFrame(
	snapshot: GameState | undefined,
	status: StatusView | undefined,
	activeTab: TuiTabId,
	selectedDatacenterIndex: number,
	statusLine: string,
	showHelp = false,
	reconnecting = false,
): string {
	return renderLayout({
		tick: status?.tick ?? snapshot?.tick ?? 0,
		cash: status?.cash ?? snapshot?.player.cash ?? 0,
		speedTps: status?.speedTps ?? 0,
		paused: status?.paused ?? true,
		activeTab,
		bodyLines: getBodyLines(snapshot, activeTab, selectedDatacenterIndex),
		statusLine,
		showHelp,
		reconnecting,
	});
}

async function executePaletteCommand(input: string): Promise<string> {
	const args = splitCommandLine(input);
	if (args.length === 0) {
		return "Command palette cancelled";
	}

	const { runCli } = await import("../cli.js");
	const output: string[] = [];
	const originalLog = console.log;
	console.log = (message?: unknown) => {
		output.push(String(message ?? ""));
	};

	try {
		await runCli(args);
		return output.at(-1) ?? `Ran: ${input}`;
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	} finally {
		console.log = originalLog;
	}
}

export async function runTui(): Promise<void> {
	const stdin = process.stdin;
	const stdout = process.stdout;
	const wasRaw = stdin.isRaw;
	let activeTab: TuiTabId = "dashboard";
	let selectedDatacenterIndex = 0;
	let showHelp = false;
	let reconnecting = false;
	let paletteOpen = false;
	let paletteInput = "";
	let paletteHistory: string[] = [];
	let paletteHistoryIndex = -1;
	let statusLine = "q quit · 1 dashboard · 2 dcs · 3 contracts · 4 catalog · : commands";

	if (!stdin.isTTY || !stdout.isTTY) {
		stdout.write(renderFrame(undefined, undefined, activeTab, selectedDatacenterIndex, statusLine));
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
		reconnecting = true;
	}

	const render = () => {
		const effectiveStatusLine = paletteOpen ? `:${paletteInput}` : statusLine;
		stdout.write(`\u001B[2J\u001B[H\u001B[?1049h\n${renderFrame(snapshot, status, activeTab, selectedDatacenterIndex, effectiveStatusLine, showHelp, reconnecting)}`);
	};

	const subscribe = async () => {
		if (!snapshot) {
			return undefined;
		}
		return await client.subscribeState(
			(nextSnapshot) => {
				snapshot = nextSnapshot;
			},
			() => {
				render();
			},
		);
	};

	let subscription = await subscribe();
	const reconnectTimer = setInterval(async () => {
		try {
			status = (await client.query({ kind: "status" })) as StatusView;
			reconnecting = false;
			if (!snapshot) {
				snapshot = (await client.query({ kind: "snapshot" })) as GameState;
				subscription = await subscribe();
			}
		} catch {
			try {
				await client.reconnect();
				status = (await client.query({ kind: "status" })) as StatusView;
				snapshot = (await client.query({ kind: "snapshot" })) as GameState;
				reconnecting = false;
				subscription = await subscribe();
			} catch {
				reconnecting = true;
			}
		}
		if (reconnecting) {
			statusLine = "Reconnecting to daemon...";
		}
		render();
	}, 1000);

	readline.emitKeypressEvents(stdin);
	stdin.setRawMode(true);
	stdin.resume();
	render();

	await new Promise<void>((resolve) => {
		const cleanup = () => {
			stdin.off("keypress", onKeypress);
			stdin.off("data", onData);
		};
		const onKeypress = async (value: string, key: readline.Key) => {
			if (paletteOpen) {
				if (key.name === "escape") {
					paletteOpen = false;
					paletteInput = "";
					statusLine = "Command palette cancelled";
					render();
					return;
				}
				if (key.name === "return") {
					paletteOpen = false;
					const command = paletteInput.trim();
					if (command) {
						paletteHistory = [...paletteHistory, command];
						paletteHistoryIndex = paletteHistory.length;
					}
					statusLine = await executePaletteCommand(command);
					paletteInput = "";
					render();
					return;
				}
				if (key.name === "backspace") {
					paletteInput = paletteInput.slice(0, -1);
					render();
					return;
				}
				if (key.name === "tab") {
					paletteInput = autocompletePaletteInput(paletteInput);
					render();
					return;
				}
				if (key.name === "up") {
					paletteHistoryIndex = Math.max(0, paletteHistoryIndex - 1);
					paletteInput = paletteHistory[paletteHistoryIndex] ?? paletteInput;
					render();
					return;
				}
				if (key.name === "down") {
					paletteHistoryIndex = Math.min(paletteHistory.length, paletteHistoryIndex + 1);
					paletteInput = paletteHistory[paletteHistoryIndex] ?? "";
					render();
					return;
				}
				if (value) {
					paletteInput += value;
					render();
				}
				return;
			}

			if (key.name === "q" || (key.ctrl && key.name === "c")) {
				cleanup();
				resolve();
				return;
			}
			if (key.name === "1") activeTab = "dashboard";
			if (key.name === "2") activeTab = "datacenters";
			if (key.name === "3") activeTab = "contracts";
			if (key.name === "4") activeTab = "catalog";
			if (key.name === "?") showHelp = !showHelp;
			if (key.name === ":") {
				paletteOpen = true;
				paletteInput = "";
				paletteHistoryIndex = paletteHistory.length;
				render();
				return;
			}
			if (activeTab === "datacenters" && key.name === "up") {
				selectedDatacenterIndex = Math.max(0, selectedDatacenterIndex - 1);
			}
			if (activeTab === "datacenters" && key.name === "down") {
				selectedDatacenterIndex = Math.min((snapshot?.datacenters.length ?? 1) - 1, selectedDatacenterIndex + 1);
			}
			if (activeTab === "datacenters" && key.name === "n") {
				paletteOpen = true;
				paletteInput = "build-dc ";
			}
			if (activeTab === "datacenters" && key.name === "r") {
				const selectedDc = snapshot?.datacenters[selectedDatacenterIndex]?.id ?? "";
				paletteOpen = true;
				paletteInput = selectedDc ? `add-rack ${selectedDc} ` : "add-rack ";
			}
			if (activeTab === "datacenters" && key.name === "x") {
				const selectedDc = snapshot?.datacenters[selectedDatacenterIndex]?.id ?? "";
				paletteOpen = true;
				paletteInput = selectedDc ? `remove-rack ${selectedDc} ` : "remove-rack ";
			}
			if (activeTab === "contracts" && key.name === "a") {
				paletteOpen = true;
				paletteInput = "accept-contract ";
			}
			if (activeTab === "contracts" && key.name === "c") {
				paletteOpen = true;
				paletteInput = "cancel-contract ";
			}
			render();
		};
		const onData = (chunk: Buffer | string) => {
			const value = chunk.toString();
			if (!paletteOpen && (value.includes("q") || value.includes("\u0003"))) {
				cleanup();
				resolve();
			}
		};
		stdin.on("keypress", onKeypress);
		stdin.on("data", onData);
	});

	clearInterval(reconnectTimer);
	await subscription?.unsubscribe().catch(() => undefined);
	await client.close().catch(() => undefined);
	stdout.write("\u001B[?1049l\u001B[2J\u001B[H");
	stdin.setRawMode(Boolean(wasRaw));
	stdin.pause();
}
