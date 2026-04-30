import type {
	ContractId,
	DatacenterId,
	DatacenterSpecId,
	GameState,
	RackPlacementId,
	RackSpecId,
} from "../types.js";

export type Action =
	| { type: "BuildDatacenter"; specId: DatacenterSpecId; dcId: DatacenterId }
	| {
			type: "PlaceRack";
			dcId: DatacenterId;
			specId: RackSpecId;
			row: number;
			position: number;
			placementId: RackPlacementId;
	  }
	| { type: "RemoveRack"; dcId: DatacenterId; placementId: RackPlacementId }
	| { type: "AcceptContract"; contractId: ContractId; dcId: DatacenterId }
	| { type: "CancelContract"; contractId: ContractId }
	| { type: "Tick" };

export function reduce(_state: GameState, _action: Action): GameState {
	throw new Error("reduce is not implemented yet.");
}
