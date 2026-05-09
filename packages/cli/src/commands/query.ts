import { DctClient } from "../client/client.js";
import type { ParsedArgv } from "../argv.js";
import { withClient, writeCommandResult, type CommandClientFactory } from "./common.js";

export async function runQueryCommand(
	parsed: ParsedArgv,
	clientFactory: CommandClientFactory = (options) => new DctClient(options),
): Promise<void> {
	const rawParams = parsed.positionals[0] ?? (typeof parsed.flags["--params"] === "string" ? parsed.flags["--params"] : undefined);
	if (!rawParams) {
		throw new Error("Missing query parameters JSON. Usage: dct query '<json>' or dct query --params '<json>'");
	}

	const params = JSON.parse(rawParams);

	const result = await withClient(
		parsed,
		async (client) => {
			return await client.query(params);
		},
		clientFactory,
	);

	writeCommandResult(parsed, "Query Result", result);
}
