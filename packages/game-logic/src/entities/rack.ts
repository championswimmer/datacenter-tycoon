import type { Capacity, RackSpec } from "../types.js";

export function rackCapacity(spec: RackSpec): Capacity {
	return {
		vCpu: spec.vCpu,
		ramGb: spec.ramGb,
		storageTb: spec.storageTb,
		gpuFlops: spec.gpuFlops,
	};
}
