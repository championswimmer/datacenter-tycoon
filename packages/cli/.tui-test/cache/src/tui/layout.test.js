//# hash=af4e458f626dcbb168cff7e93e24a75a
//# sourceMappingURL=layout.test.js.map

import assert from "node:assert/strict";
import test from "node:test";
import { renderLayout } from "./layout.js";
import { renderToMetadata } from "./test-utils.js";
test("renderLayout prints the shell with header, tabs, body, and status line", function(t) {
    var rendered = renderLayout({
        tick: 42,
        cash: 125000,
        speedTps: 4,
        paused: false,
        activeTab: "dashboard",
        bodyLines: [
            "Overview",
            "Line 2"
        ],
        statusLine: ": help",
        showHelp: false
    });
    assert.match(rendered, /Datacenter Tycoon  tick 42  cash \$125,000  speed 4x/);
    assert.match(rendered, /\[1 Dashboard\]/);
    assert.match(rendered, /2 DCs/);
    assert.match(rendered, /Overview/);
    assert.match(rendered, /: help/);
    t.assert.snapshot(renderToMetadata(rendered));
});
