import type { ParsedArgv } from "../argv.js";
import { DctClient, type DctClientOptions } from "../client/client.js";
import { resolvePaths } from "../paths.js";
import type { QueryResult, StatusView } from "../protocol/messages.js";

export interface StatusClient {
	connect(): Promise<void>;
	query(params: { kind: "status" }): Promise<QueryResult>;
	close(): Promise<void>;
}

export type StatusClientFactory = (options: DctClientOptions) => StatusClient;

function getStringFlag(parsed: ParsedArgv, flag: string): string | undefined {
	const value = parsed.flags[flag];
	return typeof value === "string" ? value : undefined;
}

function hasBooleanFlag(parsed: ParsedArgv, flag: string): boolean {
	return parsed.flags[flag] === true;
}

function formatMoney(amount: number): string {
	return `$${new Intl.NumberFormat("en-US", {
		minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
		maximumFractionDigits: 2,
	}).format(amount)}`;
}

export function formatStatusLine(status: StatusView): string {
	return [
		`tick=${status.tick}`,
		`cash=${formatMoney(status.cash)}`,
		`dcs=${status.datacenterCount}`,
		`racks=${status.rackCount}`,
		`active=${status.activeContractCount}`,
		`market=${status.marketContractCount}`,
		`paused=${status.paused}`,
		`speed=${status.speedTps}`,
	].join(" ");
}

export function formatStatusJson(status: StatusView): string {
	return JSON.stringify(
		{
			ok: true,
			data: status,
		},
		null,
		2,
	);
}

export async function runStatusCommand(
	parsed: ParsedArgv,
	clientFactory: StatusClientFactory = (options) => new DctClient(options),
): Promise<void> {
	const paths = resolvePaths({
		saveOverride: getStringFlag(parsed, "--save"),
		socketOverride: getStringFlag(parsed, "--socket"),
	});
	const client = clientFactory({
		socketPath: paths.socketPath,
		savePath: paths.savePath,
		noDaemon: hasBooleanFlag(parsed, "--no-daemon"),
	});

	try {
		await client.connect();
		const result = await client.query({ kind: "status" });
		const status = result as StatusView;
		console.log(hasBooleanFlag(parsed, "--json") ? formatStatusJson(status) : formatStatusLine(status));
	} finally {
		await client.close();
	}
}
