import { contractsFromState, selectHistoricalContracts, selectLiveContracts, selectOpenMarketContracts } from "../contracts/lifecycle.js";
import type {
	Contract,
	ContractId,
	Datacenter,
	DatacenterId,
	GameState,
	Region,
	RegionId,
} from "../types.js";

export interface EntityIndexView {
	datacenterById: ReadonlyMap<DatacenterId, Datacenter>;
	regionById: ReadonlyMap<RegionId, Region>;
}

export interface IndexedGameStateView extends EntityIndexView {
	contractById: ReadonlyMap<ContractId, Contract>;
	contracts: readonly Contract[];
	openMarketContracts: readonly Contract[];
	liveContracts: readonly Contract[];
	historicalContracts: readonly Contract[];
}

export function createEntityIndexView(
	state: Pick<GameState, "datacenters" | "map">,
): EntityIndexView {
	return {
		datacenterById: new Map(state.datacenters.map((datacenter) => [datacenter.id, datacenter])),
		regionById: new Map(state.map.regions.map((region) => [region.id, region])),
	};
}

export function createIndexedGameStateView(
	state: Pick<GameState, "datacenters" | "map" | "contracts" | "contractMarket" | "activeContracts">,
): IndexedGameStateView {
	const contracts = contractsFromState(state);
	return {
		...createEntityIndexView(state),
		contractById: new Map(contracts.map((contract) => [contract.id, contract])),
		contracts,
		openMarketContracts: selectOpenMarketContracts(contracts),
		liveContracts: selectLiveContracts(contracts),
		historicalContracts: selectHistoricalContracts(contracts),
	};
}
