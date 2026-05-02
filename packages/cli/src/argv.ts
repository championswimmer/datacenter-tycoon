export interface ParsedArgv {
	command?: string;
	positionals: string[];
	flags: Record<string, string | boolean>;
	rawArgs: string[];
}

export interface CommandDefinition {
	name: string;
	summary: string;
}

const GLOBAL_FLAGS = ["--json", "--socket", "--save", "--no-daemon", "--quiet", "-h", "--help"];

export function parseArgv(args: string[]): ParsedArgv {
	const flags: Record<string, string | boolean> = {};
	const positionals: string[] = [];
	let command: string | undefined;

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (!arg) {
			continue;
		}

		if (arg.startsWith("--")) {
			const equalsIndex = arg.indexOf("=");
			if (equalsIndex >= 0) {
				flags[arg.slice(0, equalsIndex)] = arg.slice(equalsIndex + 1);
				continue;
			}

			const nextArg = args[index + 1];
			if (nextArg && !nextArg.startsWith("-")) {
				flags[arg] = nextArg;
				index += 1;
				continue;
			}

			flags[arg] = true;
			continue;
		}

		if (arg.startsWith("-") && arg.length > 1) {
			flags[arg] = true;
			continue;
		}

		if (!command) {
			command = arg;
			continue;
		}

		positionals.push(arg);
	}

	return {
		command,
		positionals,
		flags,
		rawArgs: args,
	};
}

export function hasHelpFlag(parsed: ParsedArgv): boolean {
	return parsed.flags["-h"] === true || parsed.flags["--help"] === true;
}

export function getFlagValue(parsed: ParsedArgv, flag: string): string | boolean | undefined {
	return parsed.flags[flag];
}

export function formatHelp(commands: CommandDefinition[]): string {
	const lines = [
		"Datacenter Tycoon CLI",
		"",
		"Usage:",
		"  dct [command] [options]",
		"",
		"Commands:",
		...commands.map((command) => `  ${command.name.padEnd(18)} ${command.summary}`),
		"",
		"Global flags:",
		...GLOBAL_FLAGS.map((flag) => `  ${flag}`),
	];

	return lines.join("\n");
}
