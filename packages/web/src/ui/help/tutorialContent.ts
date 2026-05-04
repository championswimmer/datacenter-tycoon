import { RACK_CATALOG } from "@datacenter-tycoon/game-logic";
import type { RackKind } from "@datacenter-tycoon/game-logic";

export interface TutorialStep {
  id: string;
  title: string;
  body: string;
  illustration?: "racks" | "contract" | "resources" | "money";
}

/** Pick one representative rack per kind from the live catalog so stats stay current. */
function exampleRack(kind: RackKind): string {
  const spec = Object.values(RACK_CATALOG).find((r) => r.kind === kind);
  if (!spec) return "";
  return `${spec.name} (Tier ${spec.tier})`;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "racks",
    title: "Types of Racks",
    illustration: "racks",
    body: `Your datacenter is built from racks. There are four kinds, each optimized for different workloads:

• Compute — high vCPU for general-purpose workloads. Example: ${exampleRack("compute")}.
• Memory — massive RAM for in-memory databases and caching. Example: ${exampleRack("memory")}.
• Storage — huge disk capacity for archives and databases. Example: ${exampleRack("storage")}.
• GPU — specialized FLOPS for AI/ML and rendering. Example: ${exampleRack("gpu")}.

Racks come in tiers 1–3. Higher tiers deliver more capacity but draw more power and generate more heat. Tier-3 racks require liquid cooling, so they can only be placed in datacenters that support it.`,
  },
  {
    id: "contracts",
    title: "Contracts",
    illustration: "contract",
    body: `Contracts are how you turn capacity into cash. They appear in the Market with specific requirements (vCPU, RAM, storage, GPU).

• Accepting a contract makes it Active and reserves its demand against your aggregate capacity.
• Each active contract pays monthly revenue for the duration of its term.
• If you fail to meet the requirements, the contract becomes Breached and you pay a penalty.
• Completed contracts expire cleanly; cancelled ones end early with no further revenue.

Watch the market closely — offers expire if you ignore them too long.`,
  },
  {
    id: "resources",
    title: "Datacenter Resources",
    illustration: "resources",
    body: `Every rack you place consumes four finite datacenter resources:

• Power — every rack draws kW; total draw must stay under the facility's power capacity.
• Cooling — racks generate BTU/hr; air-cooled datacenters cannot host Tier-3 racks.
• Bandwidth — network throughput is shared across all racks in the facility.
• Floor Space — the grid has fixed rows and positions per row; each rack occupies one slot.

If any constraint is exceeded, you won't be able to place the rack. Plan your layout before you buy.`,
  },
  {
    id: "money",
    title: "Making Money",
    illustration: "money",
    body: `The core loop is simple, but the margins are tight:

1. Buy racks — this is capex, a one-time cost.
2. Accept contracts that your aggregate capacity can satisfy.
3. Receive monthly revenue while the contract is active.
4. Pay monthly opex — power, cooling, staff, and maintenance.
5. Profit = revenue − opex. Breaches cost penalties.

Time advances in days and months. Each in-game **month** earns revenue and pays opex. Simulation speeds run from 1× (1 month per 10 s) to 3× (1 month per 2.5 s).

Unused capacity earns nothing, so efficiency matters. Match your rack investments to the contracts you can win.`,
  },
  {
    id: "maintenance",
    title: "Aging & Maintenance",
    body: `Servers wear out as they age. Older racks are more likely to fail and spend time repairing, which means they stop contributing full usable capacity until the work is done.

If a rack is no longer worth keeping, you can decommission it from the floor view to free the slot for a replacement. You can also add more maintenance staffing in a datacenter to repair racks faster.

That extra staffing speeds recovery, but it also increases monthly wage costs — so balance resilience against overhead.`,
  },
];
