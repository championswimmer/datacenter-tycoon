//# hash=3c06719bd25cf081e581e466b4d04d62
//# sourceMappingURL=new-load.test.js.map

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
import { newGame, serialize } from "@datacenter-tycoon/game-logic";
import { parseArgv } from "../argv.js";
import { runLoadCommand, runNewCommand, runQuitCommand, runSaveCommand } from "./new-load.js";
function createTempPaths() {
    var directory = fs.mkdtempSync(path.join(os.tmpdir(), "dct-cli-save-mgmt-"));
    return {
        directory: directory,
        savePath: path.join(directory, "save.json"),
        socketPath: path.join(directory, "dct.sock"),
        importPath: path.join(directory, "import.json"),
        exportPath: path.join(directory, "export.json")
    };
}
function createFakeClient(log) {
    var snapshotTick = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 0;
    return {
        connect: function connect() {
            return _async_to_generator(function() {
                return _ts_generator(this, function(_state) {
                    log.push("connect");
                    return [
                        2
                    ];
                });
            })();
        },
        dispatch: function dispatch() {
            return _async_to_generator(function() {
                return _ts_generator(this, function(_state) {
                    log.push("dispatch");
                    return [
                        2,
                        {
                            tick: snapshotTick
                        }
                    ];
                });
            })();
        },
        query: function query(params) {
            return _async_to_generator(function() {
                return _ts_generator(this, function(_state) {
                    log.push("query:".concat(params.kind));
                    return [
                        2,
                        params.kind === "snapshot" ? {
                            tick: snapshotTick
                        } : {
                            tick: snapshotTick
                        }
                    ];
                });
            })();
        },
        control: function control(params) {
            return _async_to_generator(function() {
                return _ts_generator(this, function(_state) {
                    log.push("control:".concat(params.op));
                    return [
                        2,
                        {
                            ok: true
                        }
                    ];
                });
            })();
        },
        close: function close() {
            return _async_to_generator(function() {
                return _ts_generator(this, function(_state) {
                    log.push("close");
                    return [
                        2
                    ];
                });
            })();
        }
    };
}
test("runNewCommand requires --yes before deleting and recreating the save", function() {
    return _async_to_generator(function() {
        var _createTempPaths, savePath, socketPath;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    _createTempPaths = createTempPaths(), savePath = _createTempPaths.savePath, socketPath = _createTempPaths.socketPath;
                    return [
                        4,
                        assert.rejects(function() {
                            return runNewCommand(parseArgv([
                                "new",
                                "--save",
                                savePath,
                                "--socket",
                                socketPath
                            ]));
                        }, /--yes/)
                    ];
                case 1:
                    _state.sent();
                    return [
                        2
                    ];
            }
        });
    })();
});
test("runNewCommand recreates the save and reconnects to the daemon", function() {
    return _async_to_generator(function() {
        var _createTempPaths, savePath, socketPath, log, client;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    _createTempPaths = createTempPaths(), savePath = _createTempPaths.savePath, socketPath = _createTempPaths.socketPath;
                    log = [];
                    client = createFakeClient(log);
                    return [
                        4,
                        runNewCommand(parseArgv([
                            "new",
                            "--yes",
                            "--seed",
                            "42",
                            "--save",
                            savePath,
                            "--socket",
                            socketPath,
                            "--quiet"
                        ]), function() {
                            return client;
                        })
                    ];
                case 1:
                    _state.sent();
                    assert.equal(fs.existsSync(savePath), true);
                    assert.deepEqual(log, [
                        "connect",
                        "control:shutdown",
                        "close",
                        "connect",
                        "query:status",
                        "close"
                    ]);
                    assert.match(fs.readFileSync(savePath, "utf8"), /"seed":42/);
                    return [
                        2
                    ];
            }
        });
    })();
});
test("runLoadCommand validates and copies a save before reconnecting", function() {
    return _async_to_generator(function() {
        var _createTempPaths, savePath, socketPath, importPath, log;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    _createTempPaths = createTempPaths(), savePath = _createTempPaths.savePath, socketPath = _createTempPaths.socketPath, importPath = _createTempPaths.importPath;
                    log = [];
                    fs.writeFileSync(importPath, serialize(newGame(99)), "utf8");
                    return [
                        4,
                        runLoadCommand(parseArgv([
                            "load",
                            importPath,
                            "--save",
                            savePath,
                            "--socket",
                            socketPath,
                            "--quiet"
                        ]), function() {
                            return createFakeClient(log);
                        })
                    ];
                case 1:
                    _state.sent();
                    assert.equal(fs.existsSync(savePath), true);
                    assert.deepEqual(log, [
                        "connect",
                        "control:shutdown",
                        "close",
                        "connect",
                        "query:status",
                        "close"
                    ]);
                    assert.match(fs.readFileSync(savePath, "utf8"), /"seed":99/);
                    return [
                        2
                    ];
            }
        });
    })();
});
test("runSaveCommand forces save-now and exports a copy when requested", function() {
    return _async_to_generator(function() {
        var _createTempPaths, savePath, socketPath, exportPath, log;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    _createTempPaths = createTempPaths(), savePath = _createTempPaths.savePath, socketPath = _createTempPaths.socketPath, exportPath = _createTempPaths.exportPath;
                    log = [];
                    fs.writeFileSync(savePath, serialize(newGame(7)), "utf8");
                    return [
                        4,
                        runSaveCommand(parseArgv([
                            "save",
                            exportPath,
                            "--save",
                            savePath,
                            "--socket",
                            socketPath,
                            "--quiet"
                        ]), function() {
                            return createFakeClient(log, 12);
                        })
                    ];
                case 1:
                    _state.sent();
                    assert.deepEqual(log, [
                        "connect",
                        "control:save-now",
                        "query:snapshot",
                        "close"
                    ]);
                    assert.equal(fs.existsSync(exportPath), true);
                    assert.equal(fs.readFileSync(exportPath, "utf8"), fs.readFileSync(savePath, "utf8"));
                    return [
                        2
                    ];
            }
        });
    })();
});
test("runQuitCommand sends shutdown to the daemon", function() {
    return _async_to_generator(function() {
        var _createTempPaths, savePath, socketPath, log;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    _createTempPaths = createTempPaths(), savePath = _createTempPaths.savePath, socketPath = _createTempPaths.socketPath;
                    log = [];
                    return [
                        4,
                        runQuitCommand(parseArgv([
                            "quit",
                            "--save",
                            savePath,
                            "--socket",
                            socketPath,
                            "--quiet"
                        ]), function() {
                            return createFakeClient(log);
                        })
                    ];
                case 1:
                    _state.sent();
                    assert.deepEqual(log, [
                        "connect",
                        "control:shutdown",
                        "close"
                    ]);
                    return [
                        2
                    ];
            }
        });
    })();
});
