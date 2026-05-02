//# hash=49c58642470b87ae0ac47a3ccdd0c80a
//# sourceMappingURL=client.test.js.map

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
import { DctClient } from "./client.js";
function createSocketPath() {
    var directory = fs.mkdtempSync(path.join(os.tmpdir(), "dct-cli-client-"));
    return process.platform === "win32" ? "\\\\.\\pipe\\dct-client-".concat(Date.now()) : path.join(directory, "d.sock");
}
test("DctClient sends requests and receives subscription events from a mock server", function() {
    return _async_to_generator(function() {
        var socketPath, server, client, hello, status, receivedEventTick, subscription, controlResult, unsubscribeResult;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    socketPath = createSocketPath();
                    server = net.createServer(function(socket) {
                        var buffer = "";
                        socket.on("data", function(chunk) {
                            var _lines_pop;
                            buffer += chunk.toString();
                            var lines = buffer.split("\n");
                            buffer = (_lines_pop = lines.pop()) !== null && _lines_pop !== void 0 ? _lines_pop : "";
                            var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                            try {
                                for(var _iterator = lines[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                                    var line = _step.value;
                                    if (!line.trim()) {
                                        continue;
                                    }
                                    var request = JSON.parse(line);
                                    switch(request.method){
                                        case "hello":
                                            socket.write('{"jsonrpc":"2.0","id":'.concat(request.id, ',"result":{"daemonVersion":"0.1.0","saveVersion":1,"tick":0}}\n'));
                                            break;
                                        case "query":
                                            socket.write('{"jsonrpc":"2.0","id":'.concat(request.id, ',"result":{"tick":7,"cash":5000,"datacenterCount":1,"rackCount":2,"activeContractCount":0,"marketContractCount":4,"paused":false,"speedTps":1}}\n'));
                                            break;
                                        case "subscribe":
                                            socket.write('{"jsonrpc":"2.0","id":'.concat(request.id, ',"result":{"subId":99}}\n'));
                                            setTimeout(function() {
                                                socket.write('{"jsonrpc":"2.0","method":"event","params":{"subId":99,"event":{"type":"tick","tick":8}}}\n');
                                            }, 10);
                                            break;
                                        case "unsubscribe":
                                            socket.write('{"jsonrpc":"2.0","id":'.concat(request.id, ',"result":{"ok":true}}\n'));
                                            break;
                                        case "control":
                                            socket.write('{"jsonrpc":"2.0","id":'.concat(request.id, ',"result":{"ok":true}}\n'));
                                            break;
                                        default:
                                            socket.write('{"jsonrpc":"2.0","id":'.concat(request.id, ',"error":{"code":-32601,"message":"Unknown method"}}\n'));
                                    }
                                }
                            } catch (err) {
                                _didIteratorError = true;
                                _iteratorError = err;
                            } finally{
                                try {
                                    if (!_iteratorNormalCompletion && _iterator.return != null) {
                                        _iterator.return();
                                    }
                                } finally{
                                    if (_didIteratorError) {
                                        throw _iteratorError;
                                    }
                                }
                            }
                        });
                    });
                    server.listen(socketPath);
                    return [
                        4,
                        once(server, "listening")
                    ];
                case 1:
                    _state.sent();
                    client = new DctClient({
                        socketPath: socketPath
                    });
                    return [
                        4,
                        client.connect()
                    ];
                case 2:
                    _state.sent();
                    return [
                        4,
                        client.hello({
                            clientVersion: "0.1.0"
                        })
                    ];
                case 3:
                    hello = _state.sent();
                    assert.equal(hello.tick, 0);
                    return [
                        4,
                        client.query({
                            kind: "status"
                        })
                    ];
                case 4:
                    status = _state.sent();
                    assert.equal(status.tick, 7);
                    assert.equal(status.datacenterCount, 1);
                    return [
                        4,
                        client.subscribe([
                            "tick"
                        ], function(event) {
                            receivedEventTick = event.tick;
                        })
                    ];
                case 5:
                    subscription = _state.sent();
                    return [
                        4,
                        new Promise(function(resolve) {
                            return setTimeout(resolve, 30);
                        })
                    ];
                case 6:
                    _state.sent();
                    assert.equal(receivedEventTick, 8);
                    return [
                        4,
                        client.control({
                            op: "pause"
                        })
                    ];
                case 7:
                    controlResult = _state.sent();
                    assert.equal(controlResult.ok, true);
                    return [
                        4,
                        subscription.unsubscribe()
                    ];
                case 8:
                    unsubscribeResult = _state.sent();
                    assert.equal(unsubscribeResult.ok, true);
                    return [
                        4,
                        client.close()
                    ];
                case 9:
                    _state.sent();
                    server.close();
                    return [
                        4,
                        once(server, "close")
                    ];
                case 10:
                    _state.sent();
                    return [
                        2
                    ];
            }
        });
    })();
});
test("DctClient rejects pending requests when the socket closes", function() {
    return _async_to_generator(function() {
        var socketPath, server, client;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    socketPath = createSocketPath();
                    server = net.createServer(function(socket) {
                        socket.on("data", function() {
                            socket.destroy();
                        });
                    });
                    server.listen(socketPath);
                    return [
                        4,
                        once(server, "listening")
                    ];
                case 1:
                    _state.sent();
                    client = new DctClient({
                        socketPath: socketPath
                    });
                    return [
                        4,
                        client.connect()
                    ];
                case 2:
                    _state.sent();
                    return [
                        4,
                        assert.rejects(function() {
                            return client.hello({
                                clientVersion: "0.1.0"
                            });
                        }, /Socket closed/)
                    ];
                case 3:
                    _state.sent();
                    server.close();
                    return [
                        4,
                        once(server, "close")
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
test("DctClient reconnects and performs handshake again on a new socket", function() {
    return _async_to_generator(function() {
        var socketPath, connectionCount, server, client, firstHandshake, secondHandshake;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    socketPath = createSocketPath();
                    connectionCount = 0;
                    server = net.createServer(function(socket) {
                        connectionCount += 1;
                        var buffer = "";
                        socket.on("data", function(chunk) {
                            var _lines_pop;
                            buffer += chunk.toString();
                            var lines = buffer.split("\n");
                            buffer = (_lines_pop = lines.pop()) !== null && _lines_pop !== void 0 ? _lines_pop : "";
                            var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                            try {
                                for(var _iterator = lines[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                                    var line = _step.value;
                                    if (!line.trim()) {
                                        continue;
                                    }
                                    var request = JSON.parse(line);
                                    if (request.method === "hello") {
                                        socket.write('{"jsonrpc":"2.0","id":'.concat(request.id, ',"result":{"daemonVersion":"0.1.0","saveVersion":1,"tick":').concat(connectionCount, "}}\n"));
                                    } else if (request.method === "query") {
                                        socket.write('{"jsonrpc":"2.0","id":'.concat(request.id, ',"result":{"tick":').concat(connectionCount, ',"cash":5000,"datacenterCount":1,"rackCount":2,"activeContractCount":0,"marketContractCount":4,"paused":false,"speedTps":1}}\n'));
                                    }
                                }
                            } catch (err) {
                                _didIteratorError = true;
                                _iteratorError = err;
                            } finally{
                                try {
                                    if (!_iteratorNormalCompletion && _iterator.return != null) {
                                        _iterator.return();
                                    }
                                } finally{
                                    if (_didIteratorError) {
                                        throw _iteratorError;
                                    }
                                }
                            }
                        });
                    });
                    server.listen(socketPath);
                    return [
                        4,
                        once(server, "listening")
                    ];
                case 1:
                    _state.sent();
                    client = new DctClient({
                        socketPath: socketPath
                    });
                    return [
                        4,
                        client.connect()
                    ];
                case 2:
                    _state.sent();
                    return [
                        4,
                        client.handshake()
                    ];
                case 3:
                    firstHandshake = _state.sent();
                    assert.equal(firstHandshake.tick, 1);
                    return [
                        4,
                        client.reconnect()
                    ];
                case 4:
                    _state.sent();
                    return [
                        4,
                        client.handshake()
                    ];
                case 5:
                    secondHandshake = _state.sent();
                    assert.equal(secondHandshake.tick, 2);
                    assert.equal(connectionCount, 2);
                    return [
                        4,
                        client.close()
                    ];
                case 6:
                    _state.sent();
                    server.close();
                    return [
                        4,
                        once(server, "close")
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
test("DctClient subscribeState yields an initial snapshot and subsequent deltas", function() {
    return _async_to_generator(function() {
        var socketPath, server, client, snapshots, deltas, subscription;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    socketPath = createSocketPath();
                    server = net.createServer(function(socket) {
                        var buffer = "";
                        socket.on("data", function(chunk) {
                            var _lines_pop;
                            buffer += chunk.toString();
                            var lines = buffer.split("\n");
                            buffer = (_lines_pop = lines.pop()) !== null && _lines_pop !== void 0 ? _lines_pop : "";
                            var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                            try {
                                for(var _iterator = lines[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                                    var line = _step.value;
                                    if (!line.trim()) {
                                        continue;
                                    }
                                    var request = JSON.parse(line);
                                    if (request.method === "hello") {
                                        socket.write('{"jsonrpc":"2.0","id":'.concat(request.id, ',"result":{"daemonVersion":"0.1.0","saveVersion":1,"tick":0}}\n'));
                                    } else if (request.method === "query") {
                                        socket.write('{"jsonrpc":"2.0","id":'.concat(request.id, ',"result":{"tick":1,"seed":1,"rngState":1,"player":{"id":"player-1","name":"Player","cash":1234},"datacenters":[],"contractMarket":[],"activeContracts":[],"ledger":[],"audioEnabled":true}}\n'));
                                    } else if (request.method === "subscribe") {
                                        socket.write('{"jsonrpc":"2.0","id":'.concat(request.id, ',"result":{"subId":7}}\n'));
                                        setTimeout(function() {
                                            socket.write('{"jsonrpc":"2.0","method":"event","params":{"subId":7,"event":{"type":"tick","tick":2}}}\n');
                                            socket.write('{"jsonrpc":"2.0","method":"event","params":{"subId":7,"event":{"type":"state","tick":2,"paused":false,"speedTps":1,"snapshot":{"tick":2,"seed":1,"rngState":1,"player":{"id":"player-1","name":"Player","cash":1500},"datacenters":[],"contractMarket":[],"activeContracts":[],"ledger":[],"audioEnabled":true}}}}\n');
                                        }, 10);
                                    } else if (request.method === "unsubscribe") {
                                        socket.write('{"jsonrpc":"2.0","id":'.concat(request.id, ',"result":{"ok":true}}\n'));
                                    }
                                }
                            } catch (err) {
                                _didIteratorError = true;
                                _iteratorError = err;
                            } finally{
                                try {
                                    if (!_iteratorNormalCompletion && _iterator.return != null) {
                                        _iterator.return();
                                    }
                                } finally{
                                    if (_didIteratorError) {
                                        throw _iteratorError;
                                    }
                                }
                            }
                        });
                    });
                    server.listen(socketPath);
                    return [
                        4,
                        once(server, "listening")
                    ];
                case 1:
                    _state.sent();
                    client = new DctClient({
                        socketPath: socketPath
                    });
                    return [
                        4,
                        client.connect()
                    ];
                case 2:
                    _state.sent();
                    snapshots = [];
                    deltas = [];
                    return [
                        4,
                        client.subscribeState(function(snapshot) {
                            snapshots.push(snapshot.tick);
                        }, function(event) {
                            deltas.push(event.type);
                        })
                    ];
                case 3:
                    subscription = _state.sent();
                    return [
                        4,
                        new Promise(function(resolve) {
                            return setTimeout(resolve, 30);
                        })
                    ];
                case 4:
                    _state.sent();
                    assert.deepEqual(snapshots, [
                        1,
                        2
                    ]);
                    assert.deepEqual(deltas, [
                        "tick",
                        "state"
                    ]);
                    return [
                        4,
                        subscription.unsubscribe()
                    ];
                case 5:
                    _state.sent();
                    return [
                        4,
                        client.close()
                    ];
                case 6:
                    _state.sent();
                    server.close();
                    return [
                        4,
                        once(server, "close")
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
test("DctClient rejects incompatible daemon major versions during handshake", function() {
    return _async_to_generator(function() {
        var socketPath, server, client;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    socketPath = createSocketPath();
                    server = net.createServer(function(socket) {
                        socket.on("data", function(chunk) {
                            var line = chunk.toString().trim();
                            if (!line) {
                                return;
                            }
                            var request = JSON.parse(line);
                            if (request.method === "hello") {
                                socket.write('{"jsonrpc":"2.0","id":'.concat(request.id, ',"result":{"daemonVersion":"2.0.0","saveVersion":1,"tick":0}}\n'));
                            }
                        });
                    });
                    server.listen(socketPath);
                    return [
                        4,
                        once(server, "listening")
                    ];
                case 1:
                    _state.sent();
                    client = new DctClient({
                        socketPath: socketPath,
                        clientVersion: "1.0.0"
                    });
                    return [
                        4,
                        client.connect()
                    ];
                case 2:
                    _state.sent();
                    return [
                        4,
                        assert.rejects(function() {
                            return client.handshake();
                        }, /incompatible with client 1.0.0/)
                    ];
                case 3:
                    _state.sent();
                    return [
                        4,
                        client.close()
                    ];
                case 4:
                    _state.sent();
                    server.close();
                    return [
                        4,
                        once(server, "close")
                    ];
                case 5:
                    _state.sent();
                    return [
                        2
                    ];
            }
        });
    })();
});
