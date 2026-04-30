const UINT32_MAX_PLUS_ONE = 0x1_0000_0000;

export interface Rng {
	next(): number;
	state(): number;
}

function normalizeSeed(seed: number): number {
	return seed >>> 0;
}

export function createRng(seed: number): Rng {
	let currentState = normalizeSeed(seed);

	return {
		next(): number {
			currentState = (currentState + 0x6d2b79f5) >>> 0;
			let value = currentState;
			value = Math.imul(value ^ (value >>> 15), value | 1);
			value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
			return ((value ^ (value >>> 14)) >>> 0) / UINT32_MAX_PLUS_ONE;
		},
		state(): number {
			return currentState;
		},
	};
}

export function rngFromState(state: number): Rng {
	return createRng(state);
}
