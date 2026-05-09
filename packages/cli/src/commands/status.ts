import type { ParsedArgv } from "../argv.js";
import { DctClient, type DctClientOptions } from "../client/client.js";
import type { QueryResult, StatusView } from "../protocol/messages.js";
import { createCommandClientOptions, formatJsonResult, writeCommandResult } from "./common.js";

export interface StatusClient {
	connect(): Promise<void>;
	query(params: { kind: "status" }): Promise<QueryResult>;
	close(): Promise<void>;
}

export type StatusClientFactory = (options: DctClientOptions) => StatusClient;

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
	return formatJsonResult(status);
}

export async function runStatusCommand(
	parsed: ParsedArgv,
	clientFactory: StatusClientFactory = (options) => new DctClient(options),
): Promise<void> {
	const client = clientFactory(createCommandClientOptions(parsed));

	try {
		await client.connect();
		const result = await client.query({ kind: "status" });
		const status = result as StatusView;
		writeCommandResult(parsed, formatStatusLine(status), status);
	} finally {
		await client.close();
	}
}
