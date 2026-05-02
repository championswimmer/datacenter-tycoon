import { DctClient } from "../client/client.js";
import type { ParsedArgv } from "../argv.js";
import { parseInteger, withClient, writeCommandResult, type CommandClientFactory } from "./common.js";
import type { StatusView } from "../protocol/messages.js";

export async function runTickCommand(
	parsed: ParsedArgv,
	clientFactory: CommandClientFactory = (options) => new DctClient(options),
): Promise<void> {
	const count = parsed.positionals[0] ? parseInteger(parsed.positionals[0], "tick count") : 1;
	if (count < 0) {
		throw new Error(`Invalid tick count: ${count}`);
	}

	const status = (await withClient(
		parsed,
		async (client) => {
			for (let index = 0; index < count; index += 1) {
				await client.dispatch({ type: "Tick" });
			}
			return await client.query({ kind: "status" });
		},
		clientFactory,
	)) as StatusView;

	writeCommandResult(parsed, `Advanced ${count} tick${count === 1 ? "" : "s"} to tick ${status.tick}`, status);
}
