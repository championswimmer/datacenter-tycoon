//# hash=1913c38dbd65a25943c59a2d71eb3748
//# sourceMappingURL=catalog.test.js.map

import assert from "node:assert/strict";
import test from "node:test";
import { renderCatalogTab } from "./catalog.js";
test("renderCatalogTab includes datacenter and rack catalog entries", function() {
    var rendered = renderCatalogTab().join("\n");
    assert.match(rendered, /Datacenters:/);
    assert.match(rendered, /garage/);
    assert.match(rendered, /Racks:/);
    assert.match(rendered, /C1/);
});
