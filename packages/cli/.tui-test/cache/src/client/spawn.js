//# hash=4dd15a0aec9f4eed2bdd57a89f310444
//# sourceMappingURL=spawn.js.map

function _array_like_to_array(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes(arr) {
    if (Array.isArray(arr)) return _array_like_to_array(arr);
}
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
function _iterable_to_array(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter);
}
function _non_iterable_spread() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _to_consumable_array(arr) {
    return _array_without_holes(arr) || _iterable_to_array(arr) || _unsupported_iterable_to_array(arr) || _non_iterable_spread();
}
function _unsupported_iterable_to_array(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array(o, minLen);
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
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolvePaths } from "../paths.js";
var DEFAULT_WAIT_FOR_SOCKET_TIMEOUT_MS = 3000;
function currentCliEntrypoint() {
    var currentExtension = path.extname(fileURLToPath(import.meta.url));
    var scriptPath = fileURLToPath(new URL("../cli".concat(currentExtension), import.meta.url));
    return {
        scriptPath: scriptPath,
        useTsx: currentExtension === ".ts"
    };
}
export function waitForSocket(_0) {
    return _async_to_generator(function(socketPath) {
        var timeoutMs, deadline, unused;
        var _arguments = arguments;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    timeoutMs = _arguments.length > 1 && _arguments[1] !== void 0 ? _arguments[1] : DEFAULT_WAIT_FOR_SOCKET_TIMEOUT_MS;
                    deadline = Date.now() + timeoutMs;
                    _state.label = 1;
                case 1:
                    if (!(Date.now() < deadline)) return [
                        3,
                        7
                    ];
                    _state.label = 2;
                case 2:
                    _state.trys.push([
                        2,
                        4,
                        ,
                        6
                    ]);
                    return [
                        4,
                        new Promise(function(resolve, reject) {
                            var socket = net.createConnection(socketPath);
                            socket.once("connect", function() {
                                socket.end();
                                resolve();
                            });
                            socket.once("error", function(error) {
                                socket.destroy();
                                reject(error);
                            });
                        })
                    ];
                case 3:
                    _state.sent();
                    return [
                        2
                    ];
                case 4:
                    unused = _state.sent();
                    return [
                        4,
                        new Promise(function(resolve) {
                            return setTimeout(resolve, 50);
                        })
                    ];
                case 5:
                    _state.sent();
                    return [
                        3,
                        6
                    ];
                case 6:
                    return [
                        3,
                        1
                    ];
                case 7:
                    throw new Error("Timed out waiting for daemon socket: ".concat(socketPath));
            }
        });
    }).apply(this, arguments);
}
export function spawnDaemon(options) {
    var _options_spawnProcess;
    var _currentCliEntrypoint = currentCliEntrypoint(), scriptPath = _currentCliEntrypoint.scriptPath, useTsx = _currentCliEntrypoint.useTsx;
    var resolvedPaths = resolvePaths({
        socketOverride: options.socketPath,
        saveOverride: options.savePath
    });
    var daemonArgs = [
        scriptPath,
        "daemon",
        "--socket",
        resolvedPaths.socketPath,
        "--save",
        resolvedPaths.savePath
    ];
    if (options.idleTimeoutMs !== undefined) {
        daemonArgs.push("--idle-timeout", String(options.idleTimeoutMs));
    }
    if (options.seed !== undefined) {
        daemonArgs.push("--seed", String(options.seed));
    }
    var commandArgs = useTsx ? [
        "--import",
        "tsx"
    ].concat(_to_consumable_array(daemonArgs)) : daemonArgs;
    var spawnImpl = (_options_spawnProcess = options.spawnProcess) !== null && _options_spawnProcess !== void 0 ? _options_spawnProcess : spawn;
    var spawnOptions = {
        detached: true,
        stdio: "ignore"
    };
    var child = spawnImpl(process.execPath, commandArgs, spawnOptions);
    child.unref();
    return child;
}
export function autoSpawnDaemon(options) {
    return _async_to_generator(function() {
        var child;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    if (options.noDaemon) {
                        throw new Error("No daemon running at socket ".concat(options.socketPath));
                    }
                    child = spawnDaemon(options);
                    return [
                        4,
                        waitForSocket(options.socketPath, options.waitForSocketTimeoutMs)
                    ];
                case 1:
                    _state.sent();
                    return [
                        2,
                        child
                    ];
            }
        });
    })();
}
