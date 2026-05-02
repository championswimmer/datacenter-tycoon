import type { ContractId, DatacenterId } from "@datacenter-tycoon/game-logic";

import { DctClient } from "../client/client.js";
import type { ParsedArgv } from "../argv.js";
import { requirePositional, withClient, writeCommandResult, type CommandClientFactory } from "./common.js";

const contractId = (value: string): ContractId => value as ContractId;
const datacenterId = (value: string): DatacenterId => value as DatacenterId;

export async function runAcceptContractCommand(
	parsed: ParsedArgv,
	clientFactory: CommandClientFactory = (options) => new DctClient(options),
): Promise<void> {
	const offeredContractId = requirePositional(parsed, 0, "dct accept-contract <contractId> <dcId>");
	const dcId = requirePositional(parsed, 1, "dct accept-contract <contractId> <dcId>");

	await withClient(
		parsed,
		async (client) => {
			await client.dispatch({
				type: "AcceptContract",
				contractId: contractId(offeredContractId),
				dcId: datacenterId(dcId),
			});
		},
		clientFactory,
	);

	writeCommandResult(parsed, `Accepted contract ${offeredContractId}`, { contractId: offeredContractId, dcId });
}

export async function runCancelContractCommand(
	parsed: ParsedArgv,
	clientFactory: CommandClientFactory = (options) => new DctClient(options),
): Promise<void> {
	const activeContractId = requirePositional(parsed, 0, "dct cancel-contract <contractId>");

	await withClient(
		parsed,
		async (client) => {
			await client.dispatch({ type: "CancelContract", contractId: contractId(activeContractId) });
		},
		clientFactory,
	);

	writeCommandResult(parsed, `Cancelled contract ${activeContractId}`, { contractId: activeContractId });
}
