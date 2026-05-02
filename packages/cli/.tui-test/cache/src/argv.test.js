//# hash=39bcf93800482d292986e2a6e712e10d
//# sourceMappingURL=argv.test.js.map

import assert from "node:assert/strict";
import test from "node:test";
import { formatHelp, hasHelpFlag, parseArgv } from "./argv.js";
test("parseArgv parses commands, positionals, and mixed flag styles", function() {
    var parsed = parseArgv([
        "status",
        "primary",
        "--json",
        "--socket=/tmp/d.sock",
        "--save",
        "/tmp/save.json"
    ]);
    assert.equal(parsed.command, "status");
    assert.deepEqual(parsed.positionals, [
        "primary"
    ]);
    assert.deepEqual(parsed.flags, {
        "--json": true,
        "--socket": "/tmp/d.sock",
        "--save": "/tmp/save.json"
    });
});
test("hasHelpFlag detects both short and long help flags", function() {
    assert.equal(hasHelpFlag(parseArgv([
        "--help"
    ])), true);
    assert.equal(hasHelpFlag(parseArgv([
        "-h"
    ])), true);
    assert.equal(hasHelpFlag(parseArgv([
        "status"
    ])), false);
});
test("formatHelp prints command summaries", function() {
    var help = formatHelp([
        {
            name: "status",
            summary: "Print game status"
        },
        {
            name: "quit",
            summary: "Stop the daemon"
        }
    ]);
    assert.match(help, /Datacenter Tycoon CLI/);
    assert.match(help, /status\s+Print game status/);
    assert.match(help, /quit\s+Stop the daemon/);
    assert.match(help, /--json/);
});
