import readline from "node:readline";

import { DctClient } from "../client/client.js";
import { resolvePaths } from "../paths.js";
import type { GameState, Tick } from "@datacenter-tycoon/game-logic";
import type { StatusView } from "../protocol/messages.js";
import { renderLayout } from "./layout.js";
import { renderDashboardTab } from "./tabs/dashboard.js";

function renderFrame(snapshot: GameState | undefined, status: StatusView | undefined): string {
	return renderLayout({
		tick: status?.tick ?? snapshot?.tick ?? 0,
		cash: status?.cash ?? snapshot?.player.cash ?? 0,
		speedTps: status?.speedTps ?? 0,
		paused: status?.paused ?? true,
		activeTab: "dashboard",
		bodyLines: snapshot ? renderDashboardTab(snapshot) : ["Loading terminal UI...", "", "Press q to quit."],
		statusLine: "q quit · 1 dashboard · 2 dcs · 3 contracts · 4 catalog",
	});
}

export async function runTui(): Promise<void> {
	const stdin = process.stdin;
	const stdout = process.stdout;
	const wasRaw = stdin.isRaw;

	if (!stdin.isTTY || !stdout.isTTY) {
		stdout.write(renderFrame(undefined, undefined));
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
		// render loading shell even if connect fails for now
	}

	readline.emitKeypressEvents(stdin);
	stdin.setRawMode(true);
	stdin.resume();
	stdout.write(`\u001B[2J\u001B[H\u001B[?1049h\n${renderFrame(snapshot, status)}`);

	const subscription = snapshot
		? await client.subscribeState(
				(nextSnapshot) => {
					snapshot = nextSnapshot;
				},
				() => {
					stdout.write(`\u001B[2J\u001B[H\u001B[?1049h\n${renderFrame(snapshot, status)}`);
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
			}
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
