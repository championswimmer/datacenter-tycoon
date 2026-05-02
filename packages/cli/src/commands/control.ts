import { DctClient } from "../client/client.js";
import type { ParsedArgv } from "../argv.js";
import { getNumberFlag, requirePositional, withClient, writeCommandResult, type CommandClientFactory } from "./common.js";
import type { StatusView } from "../protocol/messages.js";

async function queryStatusAfterControl(parsed: ParsedArgv, op: "pause" | "resume" | "set-speed", ticksPerSecond?: number, clientFactory: CommandClientFactory = (options) => new DctClient(options)): Promise<StatusView> {
	return (await withClient(
		parsed,
		async (client) => {
			if (op === "set-speed") {
				await client.control({ op, ticksPerSecond: ticksPerSecond ?? 1 });
			} else {
				await client.control({ op });
			}
			return await client.query({ kind: "status" });
		},
		clientFactory,
	)) as StatusView;
}

export async function runPauseCommand(
	parsed: ParsedArgv,
	clientFactory?: CommandClientFactory,
): Promise<void> {
	const status = await queryStatusAfterControl(parsed, "pause", undefined, clientFactory);
	writeCommandResult(parsed, `Paused daemon at tick ${status.tick}`, status);
}

export async function runResumeCommand(
	parsed: ParsedArgv,
	clientFactory?: CommandClientFactory,
): Promise<void> {
	const status = await queryStatusAfterControl(parsed, "resume", undefined, clientFactory);
	writeCommandResult(parsed, `Resumed daemon at tick ${status.tick}`, status);
}

export async function runSpeedCommand(
	parsed: ParsedArgv,
	clientFactory?: CommandClientFactory,
): Promise<void> {
	const explicit = parsed.positionals[0] ?? String(getNumberFlag(parsed, "--speed", Number.NaN));
	if (!explicit || explicit === "NaN") {
		throw new Error("Usage: dct speed <ticksPerSecond>");
	}
	const ticksPerSecond = Number(explicit);
	if (!Number.isFinite(ticksPerSecond) || ticksPerSecond < 0) {
		throw new Error(`Invalid ticks/sec: ${explicit}`);
	}

	const status = await queryStatusAfterControl(parsed, "set-speed", ticksPerSecond, clientFactory);
	writeCommandResult(parsed, `Set daemon speed to ${ticksPerSecond} tps`, status);
}
