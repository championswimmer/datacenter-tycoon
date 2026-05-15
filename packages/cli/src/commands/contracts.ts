import type { ContractId, DatacenterId, GameState } from "@datacenter-tycoon/game-logic";

import { DctClient } from "../client/client.js";
import type { ParsedArgv } from "../argv.js";
import { requirePositional, withClient, writeCommandResult, type CommandClientFactory } from "./common.js";
import { runAdviseContractsCommand, runAutopilotContractsCommand } from "./contract-algorithms.js";
import { formatContractRequirements, presentContractById } from "./contracts-view.js";

const contractId = (value: string): ContractId => value as ContractId;
const datacenterId = (value: string): DatacenterId => value as DatacenterId;

function withShiftedPositionals(parsed: ParsedArgv, count: number): ParsedArgv {
	return {
		...parsed,
		positionals: parsed.positionals.slice(count),
	};
}

export async function runAcceptContractCommand(
	parsed: ParsedArgv,
	clientFactory: CommandClientFactory = (options) => new DctClient(options),
): Promise<void> {
	const offeredContractId = requirePositional(parsed, 0, "dct contract accept <contractId> <dcId>");
	const dcId = requirePositional(parsed, 1, "dct contract accept <contractId> <dcId>");

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
	const activeContractId = requirePositional(parsed, 0, "dct contract cancel <contractId>");

	await withClient(
		parsed,
		async (client) => {
			await client.dispatch({ type: "CancelContract", contractId: contractId(activeContractId) });
		},
		clientFactory,
	);

	writeCommandResult(parsed, `Cancelled contract ${activeContractId}`, { contractId: activeContractId });
}

export async function runContractDetailsCommand(
	parsed: ParsedArgv,
	clientFactory: CommandClientFactory = (options) => new DctClient(options),
): Promise<void> {
	const targetContractId = requirePositional(parsed, 0, "dct contract details <contractId>");

	const result = await withClient(
		parsed,
		async (client) => {
			const snapshot = (await client.query({ kind: "snapshot" })) as GameState;
			const contract = presentContractById(snapshot, targetContractId);
			if (!contract) {
				throw new Error(`Unknown contract: ${targetContractId}`);
			}

			const recentOutcomes = snapshot.player.reliability.recentOutcomes.filter(
				(outcome) => outcome.contractId === targetContractId,
			);

			return {
				contract,
				recentOutcomes,
			};
		},
		clientFactory,
	);

	const { contract, recentOutcomes } = result as {
		contract: NonNullable<ReturnType<typeof presentContractById>>;
		recentOutcomes: GameState["player"]["reliability"]["recentOutcomes"];
	};

	const lines = [
		`Contract ${contract.id}`,
		`${contract.name} | status=${contract.status} | urgency=${contract.urgency} | tier=${contract.tier}`,
		`Payment: $${contract.monthlyPayment.toLocaleString()}/mo | Penalty: $${contract.penaltyPerMonth.toLocaleString()}/mo | Term: ${contract.termMonths} months`,
		`Requirements: ${formatContractRequirements(contract)}`,
		contract.bucket === "history"
			? `Status: HISTORICAL (${contract.status}) — no longer live, capacity already released`
			: `Status: LIVE (${contract.status}) — currently commits capacity`,
		`Offered at tick ${contract.offeredAtTick} | Expires at tick ${contract.expiresAtTick}`,
		`Started at: ${contract.startedAtTick ?? "not started"} | Assigned DC: ${contract.assignedDcId ?? "unassigned"}`,
		"Recent SLA outcomes:",
		...(recentOutcomes.length > 0
			? recentOutcomes.map((outcome) => `  tick ${outcome.tick}: ${outcome.kind}`)
			: ["  none recorded in recent reliability history"]),
	];

	writeCommandResult(parsed, lines.join("\n"), result);
}

export async function runContractCommand(
	parsed: ParsedArgv,
	clientFactory: CommandClientFactory = (options) => new DctClient(options),
): Promise<void> {
	const subcommand = parsed.positionals[0];
	const nestedParsed = withShiftedPositionals(parsed, 1);

	if (subcommand === "accept") {
		await runAcceptContractCommand(nestedParsed, clientFactory);
		return;
	}

	if (subcommand === "cancel") {
		await runCancelContractCommand(nestedParsed, clientFactory);
		return;
	}

	if (subcommand === "details") {
		await runContractDetailsCommand(nestedParsed, clientFactory);
		return;
	}

	if (subcommand === "advise") {
		await runAdviseContractsCommand(nestedParsed, clientFactory);
		return;
	}

	if (subcommand === "autopilot") {
		await runAutopilotContractsCommand(nestedParsed, clientFactory);
		return;
	}

	throw new Error(
		"Usage: dct contract <subcommand>\n\n" +
			"Subcommands:\n" +
			"  accept <contractId> <dcId>   Accept a market contract onto a datacenter\n" +
			"  cancel <contractId>          Cancel an active contract\n" +
			"  details <contractId>         Show one contract plus recent SLA history\n" +
			"  advise [--limit N]           Show ranked recommendations (advisor algorithm)\n" +
			"  autopilot [--apply]          Plan & optionally dispatch contract actions\n\n" +
			"To list all contracts, use: dct ls contracts",
	);
}
