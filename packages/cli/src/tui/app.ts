import readline from "node:readline";

function renderHelloFrame(): string {
	return [
		"\u001B[2J\u001B[H\u001B[?1049h",
		"Datacenter Tycoon",
		"",
		"Loading terminal UI...",
		"",
		"Press q to quit.",
	].join("\n");
}

export async function runTui(): Promise<void> {
	const stdin = process.stdin;
	const stdout = process.stdout;
	const wasRaw = stdin.isRaw;

	if (!stdin.isTTY || !stdout.isTTY) {
		stdout.write(["Datacenter Tycoon", "", "Loading terminal UI...", "", "Press q to quit."].join("\n"));
		return;
	}

	readline.emitKeypressEvents(stdin);
	stdin.setRawMode(true);
	stdin.resume();
	stdout.write(renderHelloFrame());

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

	stdout.write("\u001B[?1049l\u001B[2J\u001B[H");
	stdin.setRawMode(Boolean(wasRaw));
	stdin.pause();
}
