//# hash=29b9ba7d9f5df240bc20060b0d4f3a82
//# sourceMappingURL=server.test.js.map

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
function _class_call_check(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
    }
}
function _defineProperties(target, props) {
    for(var i = 0; i < props.length; i++){
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
    }
}
function _create_class(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties(Constructor, staticProps);
    return Constructor;
}
function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
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
import { DATACENTER_CATALOG, RACK_CATALOG, SAVE_VERSION, newGame, reduce } from "@datacenter-tycoon/game-logic";
import { RpcErrorCode } from "../protocol/messages.js";
import { GamePersistence } from "./persist.js";
import { GameRuntime } from "./runtime.js";
import { GameDaemonServer } from "./server.js";
var datacenterId = function datacenterId(value) {
    return value;
};
var rackPlacementId = function rackPlacementId(value) {
    return value;
};
function createTempSavePath() {
    var tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "dct-cli-server-"));
    return path.join(tempDirectory, "save.json");
}
var FakeTransport = /*#__PURE__*/ function() {
    "use strict";
    function FakeTransport() {
        _class_call_check(this, FakeTransport);
        _define_property(this, "requestHandlers", new Set());
        _define_property(this, "disconnectHandlers", new Set());
        _define_property(this, "invalidMessageHandlers", new Set());
        _define_property(this, "sentByConnection", new Map());
        _define_property(this, "started", false);
        _define_property(this, "closed", false);
    }
    _create_class(FakeTransport, [
        {
            key: "on",
            value: function on(event, handler) {
                if (event === "request") {
                    this.requestHandlers.add(handler);
                } else if (event === "disconnect") {
                    this.disconnectHandlers.add(handler);
                } else {
                    this.invalidMessageHandlers.add(handler);
                }
                return this;
            }
        },
        {
            key: "off",
            value: function off(event, handler) {
                if (event === "request") {
                    this.requestHandlers.delete(handler);
                } else if (event === "disconnect") {
                    this.disconnectHandlers.delete(handler);
                } else {
                    this.invalidMessageHandlers.delete(handler);
                }
                return this;
            }
        },
        {
            key: "start",
            value: function start() {
                return _async_to_generator(function() {
                    return _ts_generator(this, function(_state) {
                        this.started = true;
                        return [
                            2
                        ];
                    });
                }).call(this);
            }
        },
        {
            key: "close",
            value: function close() {
                return _async_to_generator(function() {
                    return _ts_generator(this, function(_state) {
                        this.closed = true;
                        return [
                            2
                        ];
                    });
                }).call(this);
            }
        },
        {
            key: "send",
            value: function send(connection, message) {
                var _this_sentByConnection_get;
                var messages = (_this_sentByConnection_get = this.sentByConnection.get(connection.id)) !== null && _this_sentByConnection_get !== void 0 ? _this_sentByConnection_get : [];
                messages.push(message);
                this.sentByConnection.set(connection.id, messages);
                return true;
            }
        },
        {
            key: "emitRequest",
            value: function emitRequest(connection, request) {
                return _async_to_generator(function() {
                    var _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, handler, err;
                    return _ts_generator(this, function(_state) {
                        switch(_state.label){
                            case 0:
                                _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                                _state.label = 1;
                            case 1:
                                _state.trys.push([
                                    1,
                                    6,
                                    7,
                                    8
                                ]);
                                _iterator = this.requestHandlers[Symbol.iterator]();
                                _state.label = 2;
                            case 2:
                                if (!!(_iteratorNormalCompletion = (_step = _iterator.next()).done)) return [
                                    3,
                                    5
                                ];
                                handler = _step.value;
                                return [
                                    4,
                                    handler(connection, request)
                                ];
                            case 3:
                                _state.sent();
                                _state.label = 4;
                            case 4:
                                _iteratorNormalCompletion = true;
                                return [
                                    3,
                                    2
                                ];
                            case 5:
                                return [
                                    3,
                                    8
                                ];
                            case 6:
                                err = _state.sent();
                                _didIteratorError = true;
                                _iteratorError = err;
                                return [
                                    3,
                                    8
                                ];
                            case 7:
                                try {
                                    if (!_iteratorNormalCompletion && _iterator.return != null) {
                                        _iterator.return();
                                    }
                                } finally{
                                    if (_didIteratorError) {
                                        throw _iteratorError;
                                    }
                                }
                                return [
                                    7
                                ];
                            case 8:
                                return [
                                    2
                                ];
                        }
                    });
                }).call(this);
            }
        },
        {
            key: "emitDisconnect",
            value: function emitDisconnect(connection) {
                var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                try {
                    for(var _iterator = this.disconnectHandlers[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                        var handler = _step.value;
                        handler(connection);
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
            }
        },
        {
            key: "emitInvalidMessage",
            value: function emitInvalidMessage(connection, rawMessage, error) {
                var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                try {
                    for(var _iterator = this.invalidMessageHandlers[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                        var handler = _step.value;
                        handler(connection, rawMessage, error);
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
            }
        },
        {
            key: "lastMessage",
            value: function lastMessage(connection) {
                var _this_sentByConnection_get;
                var messages = (_this_sentByConnection_get = this.sentByConnection.get(connection.id)) !== null && _this_sentByConnection_get !== void 0 ? _this_sentByConnection_get : [];
                var lastMessage = messages.at(-1);
                if (!lastMessage) {
                    throw new Error("No message sent");
                }
                return lastMessage;
            }
        }
    ]);
    return FakeTransport;
}();
function createConnection(id) {
    return {
        id: id,
        socket: new net.Socket()
    };
}
function createRuntime() {
    var state = newGame(42, {
        startingCash: 3000000
    });
    state = reduce(state, {
        type: "BuildDatacenter",
        specId: DATACENTER_CATALOG.garage.id,
        dcId: datacenterId("dc-1")
    });
    state = reduce(state, {
        type: "PlaceRack",
        dcId: datacenterId("dc-1"),
        specId: RACK_CATALOG.C1.id,
        row: 0,
        position: 0,
        placementId: rackPlacementId("rp-1")
    });
    return new GameRuntime({
        state: state,
        paused: true
    });
}
test("GameDaemonServer handles hello and invalid methods", function() {
    return _async_to_generator(function() {
        var _transport_lastMessage_error, transport, server, connection;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    transport = new FakeTransport();
                    server = new GameDaemonServer({
                        transport: transport,
                        runtime: createRuntime(),
                        persistence: new GamePersistence({
                            savePath: createTempSavePath()
                        })
                    });
                    return [
                        4,
                        server.start()
                    ];
                case 1:
                    _state.sent();
                    connection = createConnection(1);
                    return [
                        4,
                        transport.emitRequest(connection, {
                            id: 1,
                            method: "hello",
                            params: {
                                clientVersion: "test"
                            }
                        })
                    ];
                case 2:
                    _state.sent();
                    assert.deepEqual(transport.lastMessage(connection), {
                        jsonrpc: "2.0",
                        id: 1,
                        result: {
                            daemonVersion: GameRuntime.getVersion(),
                            saveVersion: SAVE_VERSION,
                            tick: 0
                        }
                    });
                    return [
                        4,
                        transport.emitRequest(connection, {
                            id: 2,
                            method: "wat",
                            params: {}
                        })
                    ];
                case 3:
                    _state.sent();
                    assert.equal((_transport_lastMessage_error = transport.lastMessage(connection).error) === null || _transport_lastMessage_error === void 0 ? void 0 : _transport_lastMessage_error.code, RpcErrorCode.MethodNotFound);
                    return [
                        4,
                        server.close()
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
test("GameDaemonServer handles dispatch and query errors", function() {
    return _async_to_generator(function() {
        var _transport_lastMessage_error, _transport_lastMessage_error1, transport, server, connection;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    transport = new FakeTransport();
                    server = new GameDaemonServer({
                        transport: transport,
                        runtime: createRuntime(),
                        persistence: new GamePersistence({
                            savePath: createTempSavePath()
                        })
                    });
                    return [
                        4,
                        server.start()
                    ];
                case 1:
                    _state.sent();
                    connection = createConnection(1);
                    return [
                        4,
                        transport.emitRequest(connection, {
                            id: 1,
                            method: "dispatch",
                            params: {
                                type: "Tick"
                            }
                        })
                    ];
                case 2:
                    _state.sent();
                    assert.deepEqual(transport.lastMessage(connection), {
                        jsonrpc: "2.0",
                        id: 1,
                        result: {
                            tick: 1
                        }
                    });
                    return [
                        4,
                        transport.emitRequest(connection, {
                            id: 2,
                            method: "dispatch",
                            params: {
                                type: "RemoveRack",
                                dcId: "dc-1",
                                placementId: "missing-rack"
                            }
                        })
                    ];
                case 3:
                    _state.sent();
                    assert.equal((_transport_lastMessage_error = transport.lastMessage(connection).error) === null || _transport_lastMessage_error === void 0 ? void 0 : _transport_lastMessage_error.code, RpcErrorCode.RuntimeError);
                    return [
                        4,
                        transport.emitRequest(connection, {
                            id: 3,
                            method: "query",
                            params: {
                                kind: "status"
                            }
                        })
                    ];
                case 4:
                    _state.sent();
                    assert.equal(transport.lastMessage(connection).result.tick, 1);
                    return [
                        4,
                        transport.emitRequest(connection, {
                            id: 4,
                            method: "query",
                            params: {
                                kind: "list",
                                target: "racks"
                            }
                        })
                    ];
                case 5:
                    _state.sent();
                    assert.equal((_transport_lastMessage_error1 = transport.lastMessage(connection).error) === null || _transport_lastMessage_error1 === void 0 ? void 0 : _transport_lastMessage_error1.code, RpcErrorCode.RuntimeError);
                    return [
                        4,
                        server.close()
                    ];
                case 6:
                    _state.sent();
                    return [
                        2
                    ];
            }
        });
    })();
});
test("GameDaemonServer handles subscribe, unsubscribe, and event fanout", function() {
    return _async_to_generator(function() {
        var _transport_lastMessage_error, transport, runtime, server, connection, subscribeMessage, eventMessage;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    transport = new FakeTransport();
                    runtime = createRuntime();
                    server = new GameDaemonServer({
                        transport: transport,
                        runtime: runtime,
                        persistence: new GamePersistence({
                            savePath: createTempSavePath()
                        })
                    });
                    return [
                        4,
                        server.start()
                    ];
                case 1:
                    _state.sent();
                    connection = createConnection(1);
                    return [
                        4,
                        transport.emitRequest(connection, {
                            id: 1,
                            method: "subscribe",
                            params: {
                                events: [
                                    "tick"
                                ]
                            }
                        })
                    ];
                case 2:
                    _state.sent();
                    subscribeMessage = transport.lastMessage(connection);
                    assert.equal(subscribeMessage.result.subId, 1);
                    runtime.dispatch({
                        type: "Tick"
                    });
                    eventMessage = transport.lastMessage(connection);
                    assert.equal(eventMessage.method, "event");
                    assert.equal(eventMessage.params.event.type, "tick");
                    return [
                        4,
                        transport.emitRequest(connection, {
                            id: 2,
                            method: "unsubscribe",
                            params: {
                                subId: 1
                            }
                        })
                    ];
                case 3:
                    _state.sent();
                    assert.deepEqual(transport.lastMessage(connection), {
                        jsonrpc: "2.0",
                        id: 2,
                        result: {
                            ok: true
                        }
                    });
                    return [
                        4,
                        transport.emitRequest(connection, {
                            id: 3,
                            method: "unsubscribe",
                            params: {
                                subId: 99
                            }
                        })
                    ];
                case 4:
                    _state.sent();
                    assert.equal((_transport_lastMessage_error = transport.lastMessage(connection).error) === null || _transport_lastMessage_error === void 0 ? void 0 : _transport_lastMessage_error.code, RpcErrorCode.NotSubscribed);
                    return [
                        4,
                        server.close()
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
test("GameDaemonServer handles control operations and parse errors", function() {
    return _async_to_generator(function() {
        var _transport_lastMessage_error, _transport_lastMessage_error1, savePath, transport, shutdownRequested, runtime, server, connection;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    savePath = createTempSavePath();
                    transport = new FakeTransport();
                    shutdownRequested = false;
                    runtime = createRuntime();
                    server = new GameDaemonServer({
                        transport: transport,
                        runtime: runtime,
                        persistence: new GamePersistence({
                            savePath: savePath
                        }),
                        onShutdownRequest: function onShutdownRequest() {
                            shutdownRequested = true;
                        }
                    });
                    return [
                        4,
                        server.start()
                    ];
                case 1:
                    _state.sent();
                    connection = createConnection(1);
                    return [
                        4,
                        transport.emitRequest(connection, {
                            id: 1,
                            method: "control",
                            params: {
                                op: "pause"
                            }
                        })
                    ];
                case 2:
                    _state.sent();
                    assert.deepEqual(transport.lastMessage(connection), {
                        jsonrpc: "2.0",
                        id: 1,
                        result: {
                            ok: true
                        }
                    });
                    return [
                        4,
                        transport.emitRequest(connection, {
                            id: 2,
                            method: "control",
                            params: {
                                op: "save-now"
                            }
                        })
                    ];
                case 3:
                    _state.sent();
                    assert.equal(fs.existsSync(savePath), true);
                    assert.deepEqual(transport.lastMessage(connection), {
                        jsonrpc: "2.0",
                        id: 2,
                        result: {
                            ok: true
                        }
                    });
                    return [
                        4,
                        transport.emitRequest(connection, {
                            id: 3,
                            method: "control",
                            params: {
                                op: "set-speed",
                                ticksPerSecond: -1
                            }
                        })
                    ];
                case 4:
                    _state.sent();
                    assert.equal((_transport_lastMessage_error = transport.lastMessage(connection).error) === null || _transport_lastMessage_error === void 0 ? void 0 : _transport_lastMessage_error.code, RpcErrorCode.RuntimeError);
                    transport.emitInvalidMessage(connection, "not json", new Error("Unexpected token"));
                    assert.equal((_transport_lastMessage_error1 = transport.lastMessage(connection).error) === null || _transport_lastMessage_error1 === void 0 ? void 0 : _transport_lastMessage_error1.code, RpcErrorCode.ParseError);
                    return [
                        4,
                        transport.emitRequest(connection, {
                            id: 4,
                            method: "control",
                            params: {
                                op: "shutdown"
                            }
                        })
                    ];
                case 5:
                    _state.sent();
                    return [
                        4,
                        new Promise(function(resolve) {
                            return setImmediate(resolve);
                        })
                    ];
                case 6:
                    _state.sent();
                    assert.deepEqual(transport.lastMessage(connection), {
                        jsonrpc: "2.0",
                        id: 4,
                        result: {
                            ok: true
                        }
                    });
                    assert.equal(shutdownRequested, true);
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
