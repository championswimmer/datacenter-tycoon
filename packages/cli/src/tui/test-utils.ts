import { stripVTControlCharacters } from "node:util";

export function isTuiTestSupported(): boolean {
	try {
		// Attempt to resolve node-pty to see if it's installed and compiled properly.
		require.resolve("node-pty");
		return true;
	} catch {
		return false;
	}
}

export function renderToMetadata(ansiOutput: string): string {
	return stripVTControlCharacters(ansiOutput);
}

export function injectKeyPress(stdin: NodeJS.ReadStream, key: string | { name: string; ctrl?: boolean }): void {
	if (typeof key === "string") {
		stdin.emit("keypress", key, { name: key, ctrl: false });
	} else {
		stdin.emit("keypress", "", { name: key.name, ctrl: key.ctrl ?? false });
	}
}
