import type { Contract, GameState } from "../types.js";

export const SAVE_VERSION = 5;

export interface SaveEnvelope {
	saveVersion: number;
	state: GameState;
}

function isSaveEnvelope(value: unknown): value is SaveEnvelope {
	if (!value || typeof value !== "object") {
		return false;
	}

	return "saveVersion" in value && "state" in value;
}

function migrateContractStatus(contract: Contract): Contract {
	const legacyStatus = (contract as { status: string }).status;
	return legacyStatus === "completed"
		? { ...contract, status: "expired" }
		: contract;
}

function migrateV4ToV5(state: GameState): GameState {
	return {
		...state,
		contractMarket: state.contractMarket.map(migrateContractStatus),
		activeContracts: state.activeContracts.map(migrateContractStatus),
	};
}

export function migrate(envelope: SaveEnvelope): SaveEnvelope {
	if (envelope.saveVersion === SAVE_VERSION) {
		return envelope;
	}

	if (envelope.saveVersion === 4) {
		return {
			saveVersion: SAVE_VERSION,
			state: migrateV4ToV5(envelope.state),
		};
	}

	throw new Error(
		`Outdated save version: ${envelope.saveVersion}. Save versions earlier than 4 predate reliability tracking, so those saves must be recreated.`,
	);
}

export function serialize(state: GameState): string {
	return JSON.stringify({
		saveVersion: SAVE_VERSION,
		state,
	});
}

export function deserialize(json: string): GameState {
	const parsed = JSON.parse(json) as unknown;
	if (!isSaveEnvelope(parsed)) {
		throw new Error("Invalid save envelope.");
	}

	return migrate(parsed).state;
}
