import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const FORBIDDEN_PATTERNS: { label: string; regex: RegExp }[] = [
  {
    label: "legacy state contract buckets",
    regex: /state\.(activeContracts|contractMarket)/,
  },
  {
    label: "legacy raw contract status checks",
    regex: /status === "(active|breached|expired|cancelled)"/,
  },
  {
    label: "bypassed contract/slot utils",
    regex: /\b(contractUtils|dcFreeCapacity|canFulfill|findFirstAvailableSlot|countAvailableSlots)\b/,
  },
  {
    label: "blueprint spec instead of effective infrastructure view",
    regex: /(datacenter|dc)\.spec\.(powerCapacityKw|coolingCapacityBtuPerHr|bandwidthGbps|networkType|coolingType)/,
  },
  {
    label: "raw Tick display string",
    regex: /["'`]Tick\s+\$\{/,
  },
];

function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const st = statSync(fullPath);
    if (st.isDirectory()) {
      results.push(...collectSourceFiles(fullPath));
    } else if (
      (fullPath.endsWith(".ts") || fullPath.endsWith(".tsx")) &&
      !fullPath.endsWith(".test.ts") &&
      !fullPath.endsWith(".test.tsx")
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

describe("web query boundary compliance", () => {
  it("never duplicates game rules, queries legacy contract buckets, or reads raw infrastructure specs", () => {
    const srcRoot = resolve(__dirname, "..");
    const files = collectSourceFiles(srcRoot);
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const content = readFileSync(file, "utf8");
      for (const rule of FORBIDDEN_PATTERNS) {
        expect(
          content,
          `${file} violated query-boundary rule: ${rule.label}`,
        ).not.toMatch(rule.regex);
      }
    }
  });
});
