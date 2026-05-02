//# hash=7f47d50fe57119a624ea775f4d729696
//# sourceMappingURL=transport.test.js.map

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
import { once } from "node:events";
import { SAVE_VERSION } from "@datacenter-tycoon/game-logic";
import { DaemonTransport } from "./transport.js";
function createSocketPath() {
    var directory = fs.mkdtempSync(path.join(os.tmpdir(), "dct-cli-transport-"));
    return process.platform === "win32" ? "\\\\.\\pipe\\dct-transport-".concat(Date.now()) : path.join(directory, "d.sock");
}
test("DaemonTransport parses NDJSON requests and sends NDJSON responses", function() {
    return _async_to_generator(function() {
        var socketPath, transport, client, responseLine, response, _;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    socketPath = createSocketPath();
                    transport = new DaemonTransport({
                        socketPath: socketPath
                    });
                    return [
                        4,
                        transport.start()
                    ];
                case 1:
                    _state.sent();
                    transport.on("request", function(connection, request) {
                        var _request_id;
                        assert.equal(request.method, "hello");
                        transport.send(connection, {
                            jsonrpc: "2.0",
                            id: (_request_id = request.id) !== null && _request_id !== void 0 ? _request_id : 1,
                            result: {
                                daemonVersion: "0.1.0",
                                saveVersion: SAVE_VERSION,
                                tick: 0
                            }
                        });
                    });
                    client = net.createConnection(socketPath);
                    return [
                        4,
                        once(client, "connect")
                    ];
                case 2:
                    _state.sent();
                    responseLine = new Promise(function(resolve) {
                        var buffer = "";
                        client.on("data", function(chunk) {
                            buffer += chunk.toString();
                            var newlineIndex = buffer.indexOf("\n");
                            if (newlineIndex >= 0) {
                                resolve(buffer.slice(0, newlineIndex));
                            }
                        });
                    });
                    client.write('{"jsonrpc":"2.0","id":1,"method":"hello","params":{"clientVersion":"test"}}\n');
                    _ = JSON.parse;
                    return [
                        4,
                        responseLine
                    ];
                case 3:
                    response = _.apply(JSON, [
                        _state.sent()
                    ]);
                    assert.deepEqual(response, {
                        jsonrpc: "2.0",
                        id: 1,
                        result: {
                            daemonVersion: "0.1.0",
                            saveVersion: SAVE_VERSION,
                            tick: 0
                        }
                    });
                    client.end();
                    return [
                        4,
                        transport.close()
                    ];
                case 4:
                    _state.sent();
                    return [
                        2
                    ];
            }
        });
    })();
});
test("DaemonTransport buffers partial lines until a full request arrives", function() {
    return _async_to_generator(function() {
        var socketPath, transport, requests, client;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    socketPath = createSocketPath();
                    transport = new DaemonTransport({
                        socketPath: socketPath
                    });
                    return [
                        4,
                        transport.start()
                    ];
                case 1:
                    _state.sent();
                    requests = [];
                    transport.on("request", function(_connection, request) {
                        requests.push(request.method);
                    });
                    client = net.createConnection(socketPath);
                    return [
                        4,
                        once(client, "connect")
                    ];
                case 2:
                    _state.sent();
                    client.write('{"jsonrpc":"2.0","id":1,"method":"hel');
                    client.write('lo"}\n');
                    return [
                        4,
                        new Promise(function(resolve) {
                            return setTimeout(resolve, 10);
                        })
                    ];
                case 3:
                    _state.sent();
                    assert.deepEqual(requests, [
                        "hello"
                    ]);
                    client.end();
                    return [
                        4,
                        transport.close()
                    ];
                case 4:
                    _state.sent();
                    return [
                        2
                    ];
            }
        });
    })();
});
