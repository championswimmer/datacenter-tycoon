import assert from "node:assert/strict";
import test from "node:test";

import { REGION_CATALOG, regionIdsForContractAffinity } from "../catalog/regions.js";
import { resolveContractAffinityAllowedRegionIds } from "./region.js";

const catalogRegions = Object.values(REGION_CATALOG);
const catalogRegionIds = catalogRegions.map((region) => region.id);

test("regionIdsForContractAffinity resolves EU contract regions from the catalog", () => {
	assert.deepEqual(regionIdsForContractAffinity("eu", catalogRegions), [REGION_CATALOG.eu_west.id, REGION_CATALOG.eu_central.id]);
});

test("regionIdsForContractAffinity resolves Asia contract regions from the catalog", () => {
	assert.deepEqual(regionIdsForContractAffinity("asia", catalogRegions), [REGION_CATALOG.ap_northeast.id, REGION_CATALOG.ap_southeast.id]);
});

test("regionIdsForContractAffinity resolves USA contract regions from the catalog", () => {
	assert.deepEqual(regionIdsForContractAffinity("usa", catalogRegions), [REGION_CATALOG.us_east.id, REGION_CATALOG.us_west.id]);
});

test("resolveContractAffinityAllowedRegionIds returns every map region for unrestricted contracts", () => {
	assert.deepEqual(resolveContractAffinityAllowedRegionIds(catalogRegions), catalogRegionIds);
});
