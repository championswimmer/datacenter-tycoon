import { datacenterCapacity, PRICING_WEIGHTS } from "@datacenter-tycoon/game-logic";
import type { Capacity, Contract, Datacenter } from "@datacenter-tycoon/game-logic";

const ZERO: Capacity = { vCpu: 0, ramGb: 0, storageTb: 0, gpuFlops: 0 };

export function dcFreeCapacity(dc: Datacenter, activeContracts: Contract[]): Capacity {
  const total = datacenterCapacity(dc);
  const demand = activeContracts
    .filter(c => c.assignedDcId === dc.id && (c.status === "active" || c.status === "breached"))
    .reduce<Capacity>((acc, c) => ({
      vCpu:      acc.vCpu      + c.requirements.vCpu,
      ramGb:     acc.ramGb     + c.requirements.ramGb,
      storageTb: acc.storageTb + c.requirements.storageTb,
      gpuFlops:  acc.gpuFlops  + c.requirements.gpuFlops,
    }), ZERO);
  return {
    vCpu:      Math.max(0, total.vCpu      - demand.vCpu),
    ramGb:     Math.max(0, total.ramGb     - demand.ramGb),
    storageTb: Math.max(0, total.storageTb - demand.storageTb),
    gpuFlops:  Math.max(0, total.gpuFlops  - demand.gpuFlops),
  };
}

export function canFulfill(free: Capacity, req: Contract["requirements"]): boolean {
  return free.vCpu      >= req.vCpu      &&
         free.ramGb     >= req.ramGb     &&
         free.storageTb >= req.storageTb &&
         free.gpuFlops  >= req.gpuFlops;
}

export function contractDealScore(contract: Contract): number {
  const r = contract.requirements;
  const weightedSum =
    r.vCpu      * PRICING_WEIGHTS.vCpu +
    r.ramGb     * PRICING_WEIGHTS.ramGb +
    r.storageTb * PRICING_WEIGHTS.storageTb +
    r.gpuFlops  * PRICING_WEIGHTS.gpuFlops;
  if (weightedSum === 0) return 0;
  return contract.monthlyPayment / weightedSum;
}
