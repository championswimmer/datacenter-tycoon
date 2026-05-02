//# hash=09964dd2a423c7ce0c6570086ede7cbe
//# sourceMappingURL=test-utils.js.map

import { stripVTControlCharacters } from "node:util";
export function isTuiTestSupported() {
    try {
        // Attempt to resolve node-pty to see if it's installed and compiled properly.
        require.resolve("node-pty");
        return true;
    } catch (unused) {
        return false;
    }
}
export function renderToMetadata(ansiOutput) {
    return stripVTControlCharacters(ansiOutput);
}
export function injectKeyPress(stdin, key) {
    if (typeof key === "string") {
        stdin.emit("keypress", key, {
            name: key,
            ctrl: false
        });
    } else {
        var _key_ctrl;
        stdin.emit("keypress", "", {
            name: key.name,
            ctrl: (_key_ctrl = key.ctrl) !== null && _key_ctrl !== void 0 ? _key_ctrl : false
        });
    }
}
