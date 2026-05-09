import fs from "node:fs";
import path from "node:path";
import { deserialize } from "@datacenter-tycoon/game-logic";
import type { ParsedArgv } from "../argv.js";
import type {
  CatalogResult,
  DatacenterListItem,
  ListResult,
  RackListItem,
} from "../protocol/messages.js";
import {
  hasBooleanFlag,
  resolveCommandPaths,
  withClient,
  writeCommandResult,
} from "./common.js";
import { formatContractRequirements, presentContracts } from "./contracts-view.js";

// ── ls (router) ───────────────────────────────────────────────────────────────

export async function runLsCommand(parsed: ParsedArgv): Promise<void> {
  const subCommand = parsed.positionals[0];

  if (subCommand === "saves") {
    await listSaves(parsed);
  } else if (subCommand === "contracts") {
    await listContracts(parsed);
  } else if (subCommand === "datacenters" || subCommand === "dcs") {
    await listDatacenters(parsed);
  } else if (subCommand === "racks") {
    await listRacks(parsed);
  } else if (subCommand === "catalog") {
    await listCatalog(parsed);
  } else {
    throw new Error(
      "Usage: dct ls <subcommand>\n\nSubcommands:\n" +
        "  saves          List save files\n" +
        "  contracts      List market and active contracts\n" +
        "  datacenters    List built datacenters\n" +
        "  racks <dcId>   List racks in a datacenter\n" +
        "  catalog        List all rack and datacenter specs",
    );
  }
}

/**
 * Exported alias used by the top-level `dct contracts` command.
 */
export async function runLsContractsCommand(parsed: ParsedArgv): Promise<void> {
  return listContracts(parsed);
}

// ── saves ────────────────────────────────────────────────────────────────────

async function listSaves(parsed: ParsedArgv): Promise<void> {
  const paths = resolveCommandPaths(parsed);
  const dataDir = paths.dataDir;

  if (!fs.existsSync(dataDir)) {
    writeCommandResult(parsed, "No saves found (data directory does not exist).", { saves: [] });
    return;
  }

  const files = fs.readdirSync(dataDir).filter((f) => f.endsWith(".json"));
  const saves = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(dataDir, file), "utf8");
      const state = deserialize(content);
      saves.push({
        file,
        gameId: state.gameId,
        tick: state.tick,
        cash: state.player.cash,
        playerName: state.player.name,
      });
    } catch {
      // Skip invalid saves
    }
  }

  const table = saves
    .map((s) => {
      return `${s.file.padEnd(40)} | Tick: ${String(s.tick).padStart(6)} | Cash: $${String(s.cash).padStart(10)} | ${s.playerName}`;
    })
    .join("\n");

  writeCommandResult(
    parsed,
    saves.length > 0 ? `Available Saves:\n${table}` : "No valid saves found.",
    { saves },
  );
}

// ── contracts ────────────────────────────────────────────────────────────────

async function listContracts(parsed: ParsedArgv): Promise<void> {
  const isJson = hasBooleanFlag(parsed, "--json");

  await withClient(parsed, async (client) => {
    const marketResult = (await client.query({
      kind: "list",
      target: "market-contracts",
    })) as ListResult;
    const activeResult = (await client.query({
      kind: "list",
      target: "active-contracts",
    })) as ListResult;

    const marketContracts = marketResult.kind === "market-contracts" ? marketResult.items : [];
    const activeContracts = activeResult.kind === "active-contracts" ? activeResult.items : [];
    const market = presentContracts(marketContracts, "market");
    const active = presentContracts(activeContracts, "active");

    if (isJson) {
      writeCommandResult(parsed, "", { market, active });
      return;
    }

    const lines: string[] = [];

    if (market.length > 0) {
      lines.push("=== Market Contracts ===");
      for (const c of market) {
        lines.push(`  [${c.id}]`);
        lines.push(
          `    ${c.name} | $${c.monthlyPayment.toLocaleString()}/mo | ${c.termMonths}mo | ${c.urgency} | Tier ${c.tier} | Expires tick ${c.expiresAtTick}`,
        );
        lines.push(`    Reqs: ${formatContractRequirements(c)}`);
        lines.push(`    Penalty: $${c.penaltyPerMonth.toLocaleString()}/mo`);
      }
    } else {
      lines.push("No contracts available in market.");
    }

    lines.push("");

    if (active.length > 0) {
      lines.push("=== Active Contracts ===");
      for (const c of active) {
        lines.push(`  [${c.id}]`);
        lines.push(
          `    ${c.name} | $${c.monthlyPayment.toLocaleString()}/mo | DC: ${c.assignedDcId ?? "unassigned"} | Tier ${c.tier}`,
        );
        lines.push(`    Reqs: ${formatContractRequirements(c)}`);
      }
    } else {
      lines.push("No active contracts.");
    }

    writeCommandResult(parsed, lines.join("\n"), { market, active });
  });
}

// ── datacenters ───────────────────────────────────────────────────────────────

async function listDatacenters(parsed: ParsedArgv): Promise<void> {
  const isJson = hasBooleanFlag(parsed, "--json");

  await withClient(parsed, async (client) => {
    const result = (await client.query({
      kind: "list",
      target: "datacenters",
    })) as ListResult;

    const items =
      result.kind === "datacenters" ? (result.items as DatacenterListItem[]) : [];

    if (isJson) {
      writeCommandResult(parsed, "", { datacenters: items });
      return;
    }

    if (items.length === 0) {
      writeCommandResult(parsed, "No datacenters built yet. Use 'dct build-dc' to get started.", {
        datacenters: [],
      });
      return;
    }

    const lines: string[] = ["=== Datacenters ==="];
    for (const item of items) {
      const dc = item.datacenter;
      lines.push(
        `  ${dc.id} | ${dc.spec.id} | Region: ${dc.regionId} | Slots: ${item.slotsUsed}/${item.totalSlots}`,
      );
      lines.push(
        `    Power: ${item.powerKw.toFixed(1)}/${item.powerCapacityKw}kW | Cooling: ${Math.round(item.heatOutputBtuPerHr)}/${item.coolingCapacityBtuPerHr} BTU/hr | BW: ${item.bandwidthGbps}/${item.bandwidthCapacityGbps}Gbps`,
      );
      lines.push(
        `    Capacity: vCPU=${item.capacity.vCpu}, RAM=${item.capacity.ramGb}GB, Storage=${item.capacity.storageTb}TB, GPU=${item.capacity.gpuFlops}`,
      );
    }

    writeCommandResult(parsed, lines.join("\n"), { datacenters: items });
  });
}

// ── racks ─────────────────────────────────────────────────────────────────────

async function listRacks(parsed: ParsedArgv): Promise<void> {
  const dcId = parsed.positionals[1];
  const isJson = hasBooleanFlag(parsed, "--json");

  if (!dcId) {
    throw new Error("Usage: dct ls racks <dcId>");
  }

  await withClient(parsed, async (client) => {
    const result = (await client.query({
      kind: "list",
      target: "racks",
      dcId,
    })) as ListResult;

    const items = result.kind === "racks" ? (result.items as RackListItem[]) : [];

    if (isJson) {
      writeCommandResult(parsed, "", { dcId, racks: items });
      return;
    }

    if (items.length === 0) {
      writeCommandResult(parsed, `No racks in datacenter ${dcId}.`, { dcId, racks: [] });
      return;
    }

    const lines: string[] = [`=== Racks in ${dcId} ===`];
    for (const item of items) {
      const age = (item as unknown as Record<string, unknown>)["installedAtTick"];
      lines.push(
        `  ${item.placementId} | ${item.spec.id} (${item.spec.kind} T${item.spec.tier}) | Row ${item.row}, Pos ${item.position} | Installed: tick ${age ?? "?"}`,
      );
      lines.push(
        `    vCPU=${item.spec.vCpu}, RAM=${item.spec.ramGb}GB, Storage=${item.spec.storageTb}TB, GPU=${item.spec.gpuFlops} | Power: ${item.spec.powerDrawKw}kW`,
      );
    }

    writeCommandResult(parsed, lines.join("\n"), { dcId, racks: items });
  });
}

// ── catalog ───────────────────────────────────────────────────────────────────

async function listCatalog(parsed: ParsedArgv): Promise<void> {
  const isJson = hasBooleanFlag(parsed, "--json");

  await withClient(parsed, async (client) => {
    const rackResult = (await client.query({
      kind: "catalog",
      target: "racks",
    })) as CatalogResult;
    const dcResult = (await client.query({
      kind: "catalog",
      target: "datacenters",
    })) as CatalogResult;

    const racks = rackResult.kind === "racks" ? rackResult.items : [];
    const dcs = dcResult.kind === "datacenters" ? dcResult.items : [];

    if (isJson) {
      writeCommandResult(parsed, "", { racks, datacenters: dcs });
      return;
    }

    const lines: string[] = ["=== Rack Specs ==="];
    lines.push(
      "  ID   | Kind     | Tier | vCPU | RAM(GB) | Storage(TB) | GPU   | Power(kW) | Capex($)    | Maint/mo($)",
    );
    lines.push("  " + "-".repeat(100));
    for (const r of racks) {
      lines.push(
        `  ${r.id.padEnd(4)} | ${r.kind.padEnd(8)} | T${r.tier}   | ${String(r.vCpu).padStart(4)} | ${String(r.ramGb).padStart(7)} | ${String(r.storageTb).padStart(11)} | ${String(r.gpuFlops).padStart(5)} | ${String(r.powerDrawKw).padStart(9)} | ${String(r.capexCost).padStart(11)} | ${String(r.monthlyMaintenance).padStart(11)}`,
      );
    }

    lines.push("");
    lines.push("=== Datacenter Specs ===");
    lines.push(
      "  ID          | Slots   | Power(kW) | Cooling(BTU)  | BW(Gbps) | Capex($)     | Staff | Cooling",
    );
    lines.push("  " + "-".repeat(100));
    for (const dc of dcs) {
      const slots = dc.rows * dc.positionsPerRow;
      lines.push(
        `  ${dc.id.padEnd(11)} | ${String(slots).padStart(7)} | ${String(dc.powerCapacityKw).padStart(9)} | ${String(dc.coolingCapacityBtuPerHr).padStart(13)} | ${String(dc.bandwidthGbps).padStart(8)} | ${String(dc.capexCost).padStart(12)} | ${String(dc.staffCount).padStart(5)} | ${dc.coolingType}`,
      );
    }

    writeCommandResult(parsed, lines.join("\n"), { racks, datacenters: dcs });
  });
}
