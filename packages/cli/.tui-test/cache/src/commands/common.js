//# hash=6b0e54a776711cb08510895cf846b673
//# sourceMappingURL=common.js.map

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
    try {
        var info = gen[key](arg);
        var value = info.value;
    } catch (error) {
        reject(error);
        return;
    }
    if (info.done) {
        resolve(value);
    } else {
        Promise.resolve(value).then(_next, _throw);
    }
}
function _async_to_generator(fn) {
    return function() {
        var self = this, args = arguments;
        return new Promise(function(resolve, reject) {
            var gen = fn.apply(self, args);
            function _next(value) {
                asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
            }
            function _throw(err) {
                asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
            }
            _next(undefined);
        });
    };
}
function _instanceof(left, right) {
    "@swc/helpers - instanceof";
    if (right != null && typeof Symbol !== "undefined" && right[Symbol.hasInstance]) {
        return !!right[Symbol.hasInstance](left);
    } else {
        return left instanceof right;
    }
}
function _type_of(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
function _ts_generator(thisArg, body) {
    var f, y, t, _ = {
        label: 0,
        sent: function() {
            if (t[0] & 1) throw t[1];
            return t[1];
        },
        trys: [],
        ops: []
    }, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype), d = Object.defineProperty;
    return d(g, "next", {
        value: verb(0)
    }), d(g, "throw", {
        value: verb(1)
    }), d(g, "return", {
        value: verb(2)
    }), typeof Symbol === "function" && d(g, Symbol.iterator, {
        value: function() {
            return this;
        }
    }), g;
    function verb(n) {
        return function(v) {
            return step([
                n,
                v
            ]);
        };
    }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while(g && (g = 0, op[0] && (_ = 0)), _)try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [
                op[0] & 2,
                t.value
            ];
            switch(op[0]){
                case 0:
                case 1:
                    t = op;
                    break;
                case 4:
                    _.label++;
                    return {
                        value: op[1],
                        done: false
                    };
                case 5:
                    _.label++;
                    y = op[1];
                    op = [
                        0
                    ];
                    continue;
                case 7:
                    op = _.ops.pop();
                    _.trys.pop();
                    continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                        _ = 0;
                        continue;
                    }
                    if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                        _.label = op[1];
                        break;
                    }
                    if (op[0] === 6 && _.label < t[1]) {
                        _.label = t[1];
                        t = op;
                        break;
                    }
                    if (t && _.label < t[2]) {
                        _.label = t[2];
                        _.ops.push(op);
                        break;
                    }
                    if (t[2]) _.ops.pop();
                    _.trys.pop();
                    continue;
            }
            op = body.call(thisArg, _);
        } catch (e) {
            op = [
                6,
                e
            ];
            y = 0;
        } finally{
            f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return {
            value: op[0] ? op[1] : void 0,
            done: true
        };
    }
}
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DctClient } from "../client/client.js";
import { resolvePaths } from "../paths.js";
export function getStringFlag(parsed, flag) {
    var value = parsed.flags[flag];
    return typeof value === "string" ? value : undefined;
}
export function hasBooleanFlag(parsed, flag) {
    return parsed.flags[flag] === true;
}
export function getNumberFlag(parsed, flag, fallback) {
    var value = getStringFlag(parsed, flag);
    if (!value) {
        return fallback;
    }
    var parsedNumber = Number(value);
    if (!Number.isFinite(parsedNumber)) {
        throw new Error("Invalid value for ".concat(flag, ": ").concat(value));
    }
    return parsedNumber;
}
export function resolveCommandPaths(parsed) {
    var _getStringFlag;
    return resolvePaths({
        saveOverride: getStringFlag(parsed, "--save"),
        gameId: (_getStringFlag = getStringFlag(parsed, "--game-id")) !== null && _getStringFlag !== void 0 ? _getStringFlag : getStringFlag(parsed, "--id"),
        socketOverride: getStringFlag(parsed, "--socket")
    });
}
export function createCommandClientOptions(parsed) {
    var paths = resolveCommandPaths(parsed);
    return {
        socketPath: paths.socketPath,
        savePath: paths.savePath,
        noDaemon: hasBooleanFlag(parsed, "--no-daemon")
    };
}
export function formatJsonResult(data) {
    return JSON.stringify({
        ok: true,
        data: data
    }, null, 2);
}
export function formatJsonError(message) {
    var code = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 1;
    return JSON.stringify({
        ok: false,
        error: {
            code: code,
            message: message
        }
    }, null, 2);
}
export function writeCommandResult(parsed, text, data) {
    if (hasBooleanFlag(parsed, "--json")) {
        console.log(formatJsonResult(data !== null && data !== void 0 ? data : text));
        return;
    }
    if (!hasBooleanFlag(parsed, "--quiet")) {
        console.log(text);
    }
}
export function parseInteger(value, label) {
    var parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed)) {
        throw new Error("Invalid ".concat(label, ": ").concat(value));
    }
    return parsed;
}
export function createShortId(prefix) {
    return "".concat(prefix, "-").concat(crypto.randomUUID().slice(0, 8));
}
export function requirePositional(parsed, index, usage) {
    var value = parsed.positionals[index];
    if (!value) {
        throw new Error("Missing argument at position ".concat(index + 1, ". Usage: ").concat(usage));
    }
    return value;
}
export function withClient(parsed, run) {
    var clientFactory = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : function(options) {
        return new DctClient(options);
    };
    return _async_to_generator(function() {
        var paths, client;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    paths = resolveCommandPaths(parsed);
                    client = clientFactory(createCommandClientOptions(parsed));
                    _state.label = 1;
                case 1:
                    _state.trys.push([
                        1,
                        ,
                        4,
                        6
                    ]);
                    return [
                        4,
                        client.connect()
                    ];
                case 2:
                    _state.sent();
                    return [
                        4,
                        run(client, paths)
                    ];
                case 3:
                    return [
                        2,
                        _state.sent()
                    ];
                case 4:
                    return [
                        4,
                        client.close()
                    ];
                case 5:
                    _state.sent();
                    return [
                        7
                    ];
                case 6:
                    return [
                        2
                    ];
            }
        });
    })();
}
export function bestEffortShutdown(parsed, clientFactory) {
    return _async_to_generator(function() {
        var error, message;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    _state.trys.push([
                        0,
                        2,
                        ,
                        3
                    ]);
                    return [
                        4,
                        withClient(parsed, function(client) {
                            return _async_to_generator(function() {
                                return _ts_generator(this, function(_state) {
                                    switch(_state.label){
                                        case 0:
                                            return [
                                                4,
                                                client.control({
                                                    op: "shutdown"
                                                })
                                            ];
                                        case 1:
                                            _state.sent();
                                            return [
                                                2
                                            ];
                                    }
                                });
                            })();
                        }, clientFactory)
                    ];
                case 1:
                    _state.sent();
                    return [
                        3,
                        3
                    ];
                case 2:
                    error = _state.sent();
                    message = _instanceof(error, Error) ? error.message : String(error);
                    if (message.includes("ENOENT") || message.includes("ECONNREFUSED") || message.includes("No daemon running")) {
                        return [
                            2
                        ];
                    }
                    return [
                        3,
                        3
                    ];
                case 3:
                    return [
                        2
                    ];
            }
        });
    })();
}
export function ensureDirectoryForFile(filePath) {
    fs.mkdirSync(path.dirname(filePath), {
        recursive: true
    });
}
export function writeStateFile(savePath, serializedState) {
    ensureDirectoryForFile(savePath);
    fs.writeFileSync(savePath, serializedState, "utf8");
}
export function readStateFile(savePath) {
    return fs.readFileSync(savePath, "utf8");
}
export function copyStateFile(sourcePath, destinationPath) {
    ensureDirectoryForFile(destinationPath);
    fs.copyFileSync(sourcePath, destinationPath);
}
export function isGameState(value) {
    return Boolean(value && (typeof value === "undefined" ? "undefined" : _type_of(value)) === "object" && "tick" in value && "player" in value);
}
