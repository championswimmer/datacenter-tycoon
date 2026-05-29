import { DctClient } from "../client/client.js";
import type { ParsedArgv } from "../argv.js";
import type { StatusView } from "../protocol/messages.js";
import {
	appendOnlineSyncToCommandResult,
	syncLeaderboardFromCommand,
	type CliOnlineSyncDependencies,
} from "../online/sync.js";
import { parseInteger, withClient, writeCommandResult, type CommandClientFactory } from "./common.js";

export async function runTickCommand(
	parsed: ParsedArgv,
	clientFactory: CommandClientFactory = (options) => new DctClient(options),
	syncDependencies: CliOnlineSyncDependencies = {},
): Promise<void> {
	const count = parsed.positionals[0] ? parseInteger(parsed.positionals[0], "tick count") : 1;
	if (count < 0) {
		throw new Error(`Invalid tick count: ${count}`);
	}

	const result = await withClient(
		parsed,
		async (client, paths) => {
			for (let index = 0; index < count; index += 1) {
				await client.dispatch({ type: "Tick" });
			}

			const status = (await client.query({ kind: "status" })) as StatusView;
			const onlineSync = await syncLeaderboardFromCommand(parsed, client, paths, syncDependencies);

			return {
				status,
				onlineSync,
			};
		},
		clientFactory,
	);

	const output = appendOnlineSyncToCommandResult(
		`Advanced ${count} month${count === 1 ? "" : "s"} to tick ${result.status.tick}`,
		result.status,
		result.onlineSync,
	);

	writeCommandResult(parsed, output.text, output.data);
}
