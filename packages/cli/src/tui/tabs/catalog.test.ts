import assert from "node:assert/strict";
import test from "node:test";

import { renderCatalogTab } from "./catalog.js";

test("renderCatalogTab includes datacenter and rack catalog entries", () => {
	const rendered = renderCatalogTab().join("\n");
	assert.match(rendered, /Datacenters:/);
	assert.match(rendered, /garage/);
	assert.match(rendered, /Racks:/);
	assert.match(rendered, /C1/);
});
