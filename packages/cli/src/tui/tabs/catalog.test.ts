import assert from "node:assert/strict";
import test from "node:test";

import { REGION_CATALOG } from "@datacenter-tycoon/game-logic";
import { renderCatalogTab } from "./catalog.js";

test("renderCatalogTab includes datacenter and rack catalog entries", () => {
	const rendered = renderCatalogTab().join("\n");
	assert.match(rendered, /Regions:/);
	assert.match(rendered, new RegExp(REGION_CATALOG.us_east.code));
	assert.match(rendered, /power=\$0\.080\/kWh/);
	assert.match(rendered, /labor=\$5,850\/mo/);
	assert.match(rendered, /Datacenters:/);
	assert.match(rendered, /garage/);
	assert.match(rendered, /Racks:/);
	assert.match(rendered, /C0/);
	assert.match(rendered, /G3/);
});
