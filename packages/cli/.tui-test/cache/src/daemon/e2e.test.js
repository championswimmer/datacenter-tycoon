//# hash=be394e99eb4ba804604dfd198681c353
//# sourceMappingURL=e2e.test.js.map

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
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { DATACENTER_CATALOG, newGame } from "@datacenter-tycoon/game-logic";
import { loadOrInit, GamePersistence } from "./persist.js";
import { GameRuntime } from "./runtime.js";
import { GameDaemonServer } from "./server.js";
import { DaemonTransport } from "./transport.js";
function createTempPaths() {
    var directory = fs.mkdtempSync(path.join(os.tmpdir(), "dct-cli-e2e-"));
    return {
        savePath: path.join(directory, "save.json"),
        socketPath: path.join(directory, "dct.sock")
    };
}
function sendRpcRequest(socketPath, request) {
    return _async_to_generator(function() {
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    return [
                        4,
                        new Promise(function(resolve, reject) {
                            var socket = net.createConnection(socketPath);
                            var buffer = "";
                            socket.once("connect", function() {
                                socket.write("".concat(JSON.stringify(request), "\n"));
                            });
                            socket.on("data", function(chunk) {
                                buffer += chunk.toString();
                                var newlineIndex = buffer.indexOf("\n");
                                if (newlineIndex < 0) {
                                    return;
                                }
                                var line = buffer.slice(0, newlineIndex);
                                socket.end();
                                resolve(JSON.parse(line));
                            });
                            socket.once("error", function(error) {
                                socket.destroy();
                                reject(error);
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
test("daemon server persists autosaved state after RPC dispatch", function() {
    return _async_to_generator(function() {
        var _reloadedState_datacenters_, _createTempPaths, savePath, socketPath, persistence, runtime, transport, server, helloResponse, dispatchResponse, statusResponse, reloadedState;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    _createTempPaths = createTempPaths(), savePath = _createTempPaths.savePath, socketPath = _createTempPaths.socketPath;
                    persistence = new GamePersistence({
                        savePath: savePath,
                        debounceMs: 10
                    });
                    runtime = new GameRuntime({
                        state: newGame(123, {
                            startingCash: 3000000
                        }),
                        paused: true
                    });
                    transport = new DaemonTransport({
                        socketPath: socketPath
                    });
                    server = new GameDaemonServer({
                        transport: transport,
                        runtime: runtime,
                        persistence: persistence
                    });
                    return [
                        4,
                        server.start()
                    ];
                case 1:
                    _state.sent();
                    return [
                        4,
                        sendRpcRequest(socketPath, {
                            jsonrpc: "2.0",
                            id: 1,
                            method: "hello",
                            params: {
                                clientVersion: "test"
                            }
                        })
                    ];
                case 2:
                    helloResponse = _state.sent();
                    assert.equal(helloResponse.result.tick, 0);
                    return [
                        4,
                        sendRpcRequest(socketPath, {
                            jsonrpc: "2.0",
                            id: 2,
                            method: "dispatch",
                            params: {
                                type: "BuildDatacenter",
                                specId: DATACENTER_CATALOG.garage.id,
                                dcId: "dc-1"
                            }
                        })
                    ];
                case 3:
                    dispatchResponse = _state.sent();
                    assert.equal(dispatchResponse.result.tick, 0);
                    return [
                        4,
                        sleep(30)
                    ];
                case 4:
                    _state.sent();
                    return [
                        4,
                        persistence.waitForPendingFlush()
                    ];
                case 5:
                    _state.sent();
                    return [
                        4,
                        sendRpcRequest(socketPath, {
                            jsonrpc: "2.0",
                            id: 3,
                            method: "query",
                            params: {
                                kind: "status"
                            }
                        })
                    ];
                case 6:
                    statusResponse = _state.sent();
                    assert.equal(statusResponse.result.datacenterCount, 1);
                    reloadedState = loadOrInit(savePath, 999);
                    assert.equal(reloadedState.datacenters.length, 1);
                    assert.equal((_reloadedState_datacenters_ = reloadedState.datacenters[0]) === null || _reloadedState_datacenters_ === void 0 ? void 0 : _reloadedState_datacenters_.id, "dc-1");
                    return [
                        4,
                        server.close()
                    ];
                case 7:
                    _state.sent();
                    return [
                        2
                    ];
            }
        });
    })();
});
