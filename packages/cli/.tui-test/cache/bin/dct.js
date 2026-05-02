//# hash=cc1fda9677dbd6aa3e04ed0c74a53c60
//# sourceMappingURL=dct.js.map

#!/usr/bin/env node
function _type_of(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
try {
    var cli = await import("../dist/cli.js");
    if (cli.main) {
        await cli.main();
    }
} catch (error) {
    if (error && (typeof error === "undefined" ? "undefined" : _type_of(error)) === "object" && "code" in error && error.code === "ERR_MODULE_NOT_FOUND") {
        console.log("dct");
        process.exit(0);
    }
    throw error;
}
