export const TUI_COMMANDS = [
	"status",
	"new",
	"load",
	"save",
	"quit",
	"contracts",
	"ls",
	"dc",
	"add-rack",
	"remove-rack",
	"accept-contract",
	"cancel-contract",
	"tick",
	"pause",
	"resume",
	"speed",
] as const;

export function splitCommandLine(input: string): string[] {
	const tokens: string[] = [];
	let current = "";
	let quote: '"' | "'" | undefined;

	for (const char of input) {
		if (quote) {
			if (char === quote) {
				quote = undefined;
			} else {
				current += char;
			}
			continue;
		}

		if (char === '"' || char === "'") {
			quote = char;
			continue;
		}
		if (char === " ") {
			if (current) {
				tokens.push(current);
				current = "";
			}
			continue;
		}
		current += char;
	}

	if (current) {
		tokens.push(current);
	}

	return tokens;
}

export function autocompletePaletteInput(input: string): string {
	const trimmed = input.trimStart();
	if (trimmed.includes(" ")) {
		return input;
	}

	const matches = TUI_COMMANDS.filter((command) => command.startsWith(trimmed));
	if (matches.length === 1) {
		const prefix = input.slice(0, input.length - trimmed.length);
		return `${prefix}${matches[0]} `;
	}
	return input;
}
