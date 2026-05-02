//# hash=1379b2d6b42fb4bda5ddeb12cfda8c8c
//# sourceMappingURL=index.test.js.map

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
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawn } from "node:child_process";
import { loadOrInit } from "./daemon/persist.js";
function createTempPaths() {
    var directory = fs.mkdtempSync(path.join(os.tmpdir(), "dct-cli-integration-"));
    return {
        directory: directory,
        savePath: path.join(directory, "save.json"),
        socketPath: path.join(directory, "dct.sock")
    };
}
function runCli(args) {
    return _async_to_generator(function() {
        var child;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    child = spawn(process.execPath, [
                        "--import",
                        "tsx",
                        "src/cli.ts"
                    ].concat(_to_consumable_array(args)), {
                        cwd: process.cwd(),
                        stdio: [
                            "ignore",
                            "pipe",
                            "pipe"
                        ]
                    });
                    return [
                        4,
                        new Promise(function(resolve, reject) {
                            var _child_stdout, _child_stderr;
                            var stdout = "";
                            var stderr = "";
                            (_child_stdout = child.stdout) === null || _child_stdout === void 0 ? void 0 : _child_stdout.on("data", function(chunk) {
                                stdout += chunk.toString();
                            });
                            (_child_stderr = child.stderr) === null || _child_stderr === void 0 ? void 0 : _child_stderr.on("data", function(chunk) {
                                stderr += chunk.toString();
                            });
                            child.once("error", reject);
                            child.once("close", function(code) {
                                if (code !== 0) {
                                    reject(new Error("cli exited with code ".concat(code, ": ").concat(stderr)));
                                    return;
                                }
                                resolve({
                                    stdout: stdout,
                                    stderr: stderr
                                });
                            });
                        })
                    ];
                case 1:
                    return [
                        2,
                        _state.sent()
                    ];
            }
        });
    })();
}
test("cli integration flow can create, mutate, tick, and save a game", function() {
    return _async_to_generator(function() {
        var _state_datacenters_, _state_datacenters__placements_, _state_datacenters_1, _createTempPaths, savePath, socketPath, scoped, statusResult, statusJson, state;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    _createTempPaths = createTempPaths(), savePath = _createTempPaths.savePath, socketPath = _createTempPaths.socketPath;
                    scoped = function scoped(args) {
                        return _to_consumable_array(args).concat([
                            "--save",
                            savePath,
                            "--socket",
                            socketPath,
                            "--json"
                        ]);
                    };
                    return [
                        4,
                        runCli(scoped([
                            "new",
                            "--yes",
                            "--seed",
                            "7"
                        ]))
                    ];
                case 1:
                    _state.sent();
                    return [
                        4,
                        runCli(scoped([
                            "build-dc",
                            "garage",
                            "--id",
                            "dc-1"
                        ]))
                    ];
                case 2:
                    _state.sent();
                    return [
                        4,
                        runCli(scoped([
                            "add-rack",
                            "dc-1",
                            "0",
                            "0",
                            "C1",
                            "--id",
                            "rp-1"
                        ]))
                    ];
                case 3:
                    _state.sent();
                    return [
                        4,
                        runCli(scoped([
                            "tick",
                            "10"
                        ]))
                    ];
                case 4:
                    _state.sent();
                    return [
                        4,
                        runCli(scoped([
                            "status"
                        ]))
                    ];
                case 5:
                    statusResult = _state.sent();
                    statusJson = JSON.parse(statusResult.stdout);
                    assert.equal(statusJson.ok, true);
                    assert.equal(statusJson.data.tick, 10);
                    assert.equal(statusJson.data.datacenterCount, 1);
                    assert.equal(statusJson.data.rackCount, 1);
                    return [
                        4,
                        runCli(scoped([
                            "quit"
                        ]))
                    ];
                case 6:
                    _state.sent();
                    state = loadOrInit(savePath, 999);
                    assert.equal(state.seed, 7);
                    assert.equal(state.tick, 10);
                    assert.equal(state.datacenters.length, 1);
                    assert.equal((_state_datacenters_ = state.datacenters[0]) === null || _state_datacenters_ === void 0 ? void 0 : _state_datacenters_.id, "dc-1");
                    assert.equal((_state_datacenters_1 = state.datacenters[0]) === null || _state_datacenters_1 === void 0 ? void 0 : (_state_datacenters__placements_ = _state_datacenters_1.placements[0]) === null || _state_datacenters__placements_ === void 0 ? void 0 : _state_datacenters__placements_.id, "rp-1");
                    return [
                        2
                    ];
            }
        });
    })();
});
