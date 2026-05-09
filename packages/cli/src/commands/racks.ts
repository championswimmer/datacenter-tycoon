import { DctClient } from "../client/client.js";
import type { ParsedArgv } from "../argv.js";
import type { CommandClientFactory } from "./common.js";
import { runAddRackCommand, runMoveRackCommand, runRemoveRackCommand } from "./build-dc.js";

function withShiftedPositionals(parsed: ParsedArgv, count: number): ParsedArgv {
	return {
		...parsed,
		positionals: parsed.positionals.slice(count),
	};
}

export async function runRacksCommand(
	parsed: ParsedArgv,
	clientFactory: CommandClientFactory = (options) => new DctClient(options),
): Promise<void> {
	const subcommand = parsed.positionals[0];
	const nestedParsed = withShiftedPositionals(parsed, 1);

	if (subcommand === "add") {
		await runAddRackCommand(nestedParsed, clientFactory);
		return;
	}

	if (subcommand === "decom") {
		await runRemoveRackCommand(nestedParsed, clientFactory);
		return;
	}

	if (subcommand === "move") {
		await runMoveRackCommand(nestedParsed, clientFactory);
		return;
	}

	throw new Error(
		"Usage: dct racks <subcommand>\n\n" +
			"Subcommands:\n" +
			"  add <dcId> <row> <position> <rackSpecId> [--id <placementId>]   Add a rack\n" +
			"  decom <dcId> <placementId>                                     Decommission a rack\n" +
			"  move <dcId> <placementId> <targetDcId> <row> <position>       Move a rack",
	);
}
