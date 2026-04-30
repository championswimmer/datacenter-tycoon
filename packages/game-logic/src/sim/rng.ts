export interface Rng {
	next(): number;
	state(): number;
}

export function createRng(_seed: number): Rng {
	throw new Error("createRng is not implemented yet.");
}

export function rngFromState(_state: number): Rng {
	throw new Error("rngFromState is not implemented yet.");
}
