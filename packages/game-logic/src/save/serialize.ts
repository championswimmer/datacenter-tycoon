import { contractsFromState, stripDerivedContractViews, withDerivedContractViews } from "../contracts/lifecycle.js";
import { withContractSlaDefaults } from "../contracts/sla.js";
import { createEmptyRegionFabric } from "../entities/fabric.js";
import { backfillFinancialHistoryFromLedger } from "../state/financial-history.js";
import type { GameState, PersistedGameState, Subtick } from "../types.js";

export const SAVE_VERSION = 14;

export interface SaveEnvelope<TState = PersistedGameState> {
	saveVersion: number;
	state: TState;
}

type LegacyPersistedGameState = PersistedGameState & {
	subtick?: Subtick;
	financialHistory?: PersistedGameState["financialHistory"];
};

function isSaveEnvelope(value: unknown): value is SaveEnvelope<LegacyPersistedGameState> {
	if (!value || typeof value !== "object") {
		return false;
	}

	return "saveVersion" in value && "state" in value;
}

function attachEmptyRegionalFabrics(state: LegacyPersistedGameState): LegacyPersistedGameState {
	return {
		...state,
		map: {
			...state.map,
			regions: state.map.regions.map((region) => ({
				...region,
				fabric: region.fabric ?? createEmptyRegionFabric(),
			})),
		},
	};
}

function attachInitialSubtick(state: LegacyPersistedGameState): PersistedGameState {
	return {
		...state,
		subtick: (state.subtick ?? (0 as Subtick)) as Subtick,
	};
}

function attachContractSlaDefaults(state: PersistedGameState): PersistedGameState {
	const contracts = contractsFromState({
		contracts: state.contracts.map(withContractSlaDefaults),
		contractMarket: state.contractMarket?.map(withContractSlaDefaults) ?? [],
		activeContracts: state.activeContracts?.map(withContractSlaDefaults) ?? [],
	});
	return {
		...state,
		contracts,
		contractMarket: state.contractMarket?.map(withContractSlaDefaults),
		activeContracts: state.activeContracts?.map(withContractSlaDefaults),
	};
}

function attachFinancialHistory(state: LegacyPersistedGameState): PersistedGameState {
	return {
		...state,
		financialHistory:
			state.financialHistory && state.financialHistory.length > 0
				? state.financialHistory
				: backfillFinancialHistoryFromLedger(state),
	};
}

function rehydrateDerivedContractViews(state: PersistedGameState): GameState {
	return withDerivedContractViews({
		...state,
		contractMarket: [],
		activeContracts: [],
	} as GameState);
}

function attachModernDefaults(state: LegacyPersistedGameState): GameState {
	return rehydrateDerivedContractViews(attachContractSlaDefaults(attachFinancialHistory(attachInitialSubtick(state))));
}

export function migrate(envelope: SaveEnvelope<LegacyPersistedGameState>): SaveEnvelope<GameState> {
	if (envelope.saveVersion === SAVE_VERSION) {
		return {
			...envelope,
			state: attachModernDefaults(envelope.state),
		};
	}

	if (envelope.saveVersion === 13) {
		return {
			saveVersion: SAVE_VERSION,
			state: attachModernDefaults(envelope.state),
		};
	}

	if (envelope.saveVersion === 11) {
		return {
			saveVersion: SAVE_VERSION,
			state: attachModernDefaults(envelope.state),
		};
	}

	if (envelope.saveVersion === 10) {
		return {
			saveVersion: SAVE_VERSION,
			state: attachModernDefaults(envelope.state),
		};
	}

	if (envelope.saveVersion === 9) {
		return {
			saveVersion: SAVE_VERSION,
			state: attachModernDefaults(envelope.state),
		};
	}

	if (envelope.saveVersion === 8) {
		return {
			saveVersion: SAVE_VERSION,
			state: attachModernDefaults(envelope.state),
		};
	}

	if (envelope.saveVersion === 7) {
		return {
			saveVersion: SAVE_VERSION,
			state: attachModernDefaults(attachEmptyRegionalFabrics(envelope.state)),
		};
	}

	throw new Error(`Outdated save version: ${envelope.saveVersion}. Start a new game with save version ${SAVE_VERSION}.`);
}

export function serialize(state: GameState): string {
	return JSON.stringify({
		saveVersion: SAVE_VERSION,
		state: stripDerivedContractViews(state),
	} satisfies SaveEnvelope);
}

export function deserialize(json: string): GameState {
	const parsed = JSON.parse(json) as unknown;
	if (!isSaveEnvelope(parsed)) {
		throw new Error("Invalid save envelope.");
	}

	return migrate(parsed).state;
}
