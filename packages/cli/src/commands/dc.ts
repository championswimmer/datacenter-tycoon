import { DctClient } from "../client/client.js";
import type { ParsedArgv } from "../argv.js";
import type { CommandClientFactory } from "./common.js";
import { runBuildDatacenterCommand } from "./build-dc.js";

function withShiftedPositionals(parsed: ParsedArgv, count: number): ParsedArgv {
	return {
		...parsed,
		positionals: parsed.positionals.slice(count),
	};
}

export async function runDcCommand(
	parsed: ParsedArgv,
	clientFactory: CommandClientFactory = (options) => new DctClient(options),
): Promise<void> {
	const subcommand = parsed.positionals[0];
	const nestedParsed = withShiftedPositionals(parsed, 1);

	if (subcommand === "build") {
		await runBuildDatacenterCommand(nestedParsed, clientFactory);
		return;
	}

	if (subcommand === "decom") {
		throw new Error("Usage: dct dc decom <dcId>\n\nDatacenter decommissioning is not implemented yet.");
	}

	throw new Error(
		"Usage: dct dc <subcommand>\n\n" +
			"Subcommands:\n" +
			"  build <specId> [--id <dcId>] [--region <regionId>]   Build a datacenter\n" +
			"  decom <dcId>                                        Not implemented yet",
	);
}
