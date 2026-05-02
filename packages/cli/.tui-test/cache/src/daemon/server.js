//# hash=f37ddbd028bbba0df2382ab3babe7fa7
//# sourceMappingURL=server.js.map

function _assert_this_initialized(self) {
    if (self === void 0) {
        throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }
    return self;
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
function _call_super(_this, derived, args) {
    derived = _get_prototype_of(derived);
    return _possible_constructor_return(_this, _is_native_reflect_construct() ? Reflect.construct(derived, args || [], _get_prototype_of(_this).constructor) : derived.apply(_this, args));
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
function _get_prototype_of(o) {
    _get_prototype_of = Object.setPrototypeOf ? Object.getPrototypeOf : function getPrototypeOf(o) {
        return o.__proto__ || Object.getPrototypeOf(o);
    };
    return _get_prototype_of(o);
}
function _inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
        throw new TypeError("Super expression must either be null or a function");
    }
    subClass.prototype = Object.create(superClass && superClass.prototype, {
        constructor: {
            value: subClass,
            writable: true,
            configurable: true
        }
    });
    if (superClass) _set_prototype_of(subClass, superClass);
}
function _instanceof(left, right) {
    "@swc/helpers - instanceof";
    if (right != null && typeof Symbol !== "undefined" && right[Symbol.hasInstance]) {
        return !!right[Symbol.hasInstance](left);
    } else {
        return left instanceof right;
    }
}
function _possible_constructor_return(self, call) {
    if (call && (_type_of(call) === "object" || typeof call === "function")) {
        return call;
    }
    return _assert_this_initialized(self);
}
function _set_prototype_of(o, p) {
    _set_prototype_of = Object.setPrototypeOf || function setPrototypeOf(o, p) {
        o.__proto__ = p;
        return o;
    };
    return _set_prototype_of(o, p);
}
function _type_of(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
function _is_native_reflect_construct() {
    try {
        var result = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {}));
    } catch (_) {}
    return (_is_native_reflect_construct = function() {
        return !!result;
    })();
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
import { EventEmitter } from "node:events";
import { SAVE_VERSION } from "@datacenter-tycoon/game-logic";
import { RpcErrorCode } from "../protocol/messages.js";
import { GameRuntime } from "./runtime.js";
function isRpcMethod(value) {
    return value === "hello" || value === "dispatch" || value === "query" || value === "subscribe" || value === "unsubscribe" || value === "control";
}
function errorWithCode(code, message, data) {
    return {
        code: code,
        message: message,
        data: data
    };
}
function normalizeError(error) {
    if (error && (typeof error === "undefined" ? "undefined" : _type_of(error)) === "object" && "code" in error && typeof error.code === "number" && "message" in error && typeof error.message === "string") {
        return {
            code: error.code,
            message: error.message,
            data: "data" in error ? error.data : undefined
        };
    }
    if (_instanceof(error, Error)) {
        return errorWithCode(RpcErrorCode.RuntimeError, error.message);
    }
    return errorWithCode(RpcErrorCode.InternalError, "Unknown server error", error);
}
export var GameDaemonServer = /*#__PURE__*/ function(EventEmitter) {
    "use strict";
    _inherits(GameDaemonServer, EventEmitter);
    function GameDaemonServer(options) {
        _class_call_check(this, GameDaemonServer);
        var _this;
        var _this1;
        _this = _call_super(this, GameDaemonServer), _this1 = _this, _define_property(_this, "transport", void 0), _define_property(_this, "runtime", void 0), _define_property(_this, "persistence", void 0), _define_property(_this, "onShutdownRequest", void 0), _define_property(_this, "subscriptions", new Map()), _define_property(_this, "connectionSubscriptions", new Map()), _define_property(_this, "nextSubId", 1), _define_property(_this, "started", false), _define_property(_this, "handleDisconnect", function(connection) {
            var subIds = _this.connectionSubscriptions.get(connection.id);
            if (!subIds) {
                return;
            }
            var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
            try {
                for(var _iterator = subIds[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                    var subId = _step.value;
                    _this.subscriptions.delete(subId);
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
            _this.connectionSubscriptions.delete(connection.id);
        }), _define_property(_this, "handleInvalidMessage", function(connection, rawMessage, error) {
            _this.transport.send(connection, {
                jsonrpc: "2.0",
                id: 0,
                error: {
                    code: RpcErrorCode.ParseError,
                    message: error.message,
                    data: rawMessage
                }
            });
        }), _define_property(_this, "handleRequest", function(connection, request) {
            return _async_to_generator(function() {
                var _request_id, result, error;
                return _ts_generator(this, function(_state) {
                    switch(_state.label){
                        case 0:
                            if (!isRpcMethod(request.method)) {
                                ;
                                _this1.respondError(connection, (_request_id = request.id) !== null && _request_id !== void 0 ? _request_id : 0, errorWithCode(RpcErrorCode.MethodNotFound, "Unknown method: ".concat(request.method)));
                                return [
                                    2
                                ];
                            }
                            _state.label = 1;
                        case 1:
                            _state.trys.push([
                                1,
                                3,
                                ,
                                4
                            ]);
                            return [
                                4,
                                _this1.dispatchMethod(connection, request.method, request.params)
                            ];
                        case 2:
                            result = _state.sent();
                            if (request.id !== undefined) {
                                _this1.respondResult(connection, request.id, result);
                            }
                            return [
                                3,
                                4
                            ];
                        case 3:
                            error = _state.sent();
                            if (request.id !== undefined) {
                                _this1.respondError(connection, request.id, normalizeError(error));
                            }
                            return [
                                3,
                                4
                            ];
                        case 4:
                            return [
                                2
                            ];
                    }
                });
            })();
        });
        _this.transport = options.transport;
        _this.runtime = options.runtime;
        _this.persistence = options.persistence;
        _this.onShutdownRequest = options.onShutdownRequest;
        return _this;
    }
    _create_class(GameDaemonServer, [
        {
            key: "start",
            value: function start() {
                return _async_to_generator(function() {
                    return _ts_generator(this, function(_state) {
                        switch(_state.label){
                            case 0:
                                if (this.started) {
                                    return [
                                        2
                                    ];
                                }
                                this.started = true;
                                this.transport.on("request", this.handleRequest);
                                this.transport.on("disconnect", this.handleDisconnect);
                                this.transport.on("invalidMessage", this.handleInvalidMessage);
                                this.runtime.on("state", this.handleRuntimeEvent("state"));
                                this.runtime.on("tick", this.handleRuntimeEvent("tick"));
                                this.runtime.on("ledger", this.handleRuntimeEvent("ledger"));
                                return [
                                    4,
                                    this.transport.start()
                                ];
                            case 1:
                                _state.sent();
                                this.runtime.start();
                                return [
                                    2
                                ];
                        }
                    });
                }).call(this);
            }
        },
        {
            key: "close",
            value: function close() {
                return _async_to_generator(function() {
                    return _ts_generator(this, function(_state) {
                        switch(_state.label){
                            case 0:
                                this.runtime.stop();
                                return [
                                    4,
                                    this.persistence.flush(this.runtime.getSnapshot())
                                ];
                            case 1:
                                _state.sent();
                                this.transport.off("request", this.handleRequest);
                                this.transport.off("disconnect", this.handleDisconnect);
                                this.transport.off("invalidMessage", this.handleInvalidMessage);
                                return [
                                    4,
                                    this.transport.close()
                                ];
                            case 2:
                                _state.sent();
                                this.subscriptions.clear();
                                this.connectionSubscriptions.clear();
                                this.started = false;
                                return [
                                    2
                                ];
                        }
                    });
                }).call(this);
            }
        },
        {
            key: "handleRuntimeEvent",
            value: function handleRuntimeEvent(eventType) {
                var _this = this;
                return function(event) {
                    if (event.type === "state") {
                        _this.persistence.scheduleAutosave(event.snapshot);
                    }
                    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                    try {
                        for(var _iterator = _this.subscriptions.values()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                            var subscription = _step.value;
                            if (!subscription.events.has(eventType)) {
                                continue;
                            }
                            _this.transport.send(subscription.connection, {
                                jsonrpc: "2.0",
                                method: "event",
                                params: {
                                    subId: subscription.subId,
                                    event: event
                                }
                            });
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
                };
            }
        },
        {
            key: "respondResult",
            value: function respondResult(connection, id, result) {
                this.transport.send(connection, {
                    jsonrpc: "2.0",
                    id: id,
                    result: result
                });
            }
        },
        {
            key: "respondError",
            value: function respondError(connection, id, error) {
                this.transport.send(connection, {
                    jsonrpc: "2.0",
                    id: id,
                    error: error
                });
            }
        },
        {
            key: "dispatchMethod",
            value: function dispatchMethod(connection, method, params) {
                return _async_to_generator(function() {
                    var nextState;
                    return _ts_generator(this, function(_state) {
                        switch(method){
                            case "hello":
                                return [
                                    2,
                                    this.handleHello()
                                ];
                            case "dispatch":
                                {
                                    nextState = this.runtime.dispatch(params);
                                    return [
                                        2,
                                        {
                                            tick: nextState.tick
                                        }
                                    ];
                                }
                            case "query":
                                return [
                                    2,
                                    this.runtime.query(params)
                                ];
                            case "subscribe":
                                return [
                                    2,
                                    this.handleSubscribe(connection, params)
                                ];
                            case "unsubscribe":
                                return [
                                    2,
                                    this.handleUnsubscribe(connection, params)
                                ];
                            case "control":
                                return [
                                    2,
                                    this.handleControl(params)
                                ];
                            default:
                                throw errorWithCode(RpcErrorCode.MethodNotFound, "Unknown method: ".concat(method));
                        }
                        return [
                            2
                        ];
                    });
                }).call(this);
            }
        },
        {
            key: "handleHello",
            value: function handleHello() {
                return {
                    daemonVersion: GameRuntime.getVersion(),
                    saveVersion: SAVE_VERSION,
                    tick: this.runtime.getSnapshot().tick
                };
            }
        },
        {
            key: "handleSubscribe",
            value: function handleSubscribe(connection, params) {
                if (!params || !Array.isArray(params.events) || params.events.length === 0) {
                    throw errorWithCode(RpcErrorCode.InvalidParams, "subscribe requires a non-empty events array");
                }
                var subId = this.nextSubId;
                this.nextSubId += 1;
                var subscription = {
                    subId: subId,
                    connection: connection,
                    events: new Set(params.events)
                };
                this.subscriptions.set(subId, subscription);
                var connectionSubIds = this.connectionSubscriptions.get(connection.id);
                if (!connectionSubIds) {
                    connectionSubIds = new Set();
                    this.connectionSubscriptions.set(connection.id, connectionSubIds);
                }
                connectionSubIds.add(subId);
                return {
                    subId: subId
                };
            }
        },
        {
            key: "handleUnsubscribe",
            value: function handleUnsubscribe(connection, params) {
                var _this_connectionSubscriptions_get;
                var subscription = params ? this.subscriptions.get(params.subId) : undefined;
                if (!subscription || subscription.connection.id !== connection.id) {
                    var _ref;
                    throw errorWithCode(RpcErrorCode.NotSubscribed, "Unknown subscription: ".concat((_ref = params === null || params === void 0 ? void 0 : params.subId) !== null && _ref !== void 0 ? _ref : "missing"));
                }
                this.subscriptions.delete(subscription.subId);
                (_this_connectionSubscriptions_get = this.connectionSubscriptions.get(connection.id)) === null || _this_connectionSubscriptions_get === void 0 ? void 0 : _this_connectionSubscriptions_get.delete(subscription.subId);
                return {
                    ok: true
                };
            }
        },
        {
            key: "handleControl",
            value: function handleControl(params) {
                return _async_to_generator(function() {
                    var _this, _;
                    return _ts_generator(this, function(_state) {
                        switch(_state.label){
                            case 0:
                                _this = this;
                                if (!params || (typeof params === "undefined" ? "undefined" : _type_of(params)) !== "object" || !("op" in params)) {
                                    throw errorWithCode(RpcErrorCode.InvalidParams, "control requires an op field");
                                }
                                _ = params.op;
                                switch(_){
                                    case "pause":
                                        return [
                                            3,
                                            1
                                        ];
                                    case "resume":
                                        return [
                                            3,
                                            2
                                        ];
                                    case "set-speed":
                                        return [
                                            3,
                                            3
                                        ];
                                    case "save-now":
                                        return [
                                            3,
                                            4
                                        ];
                                    case "shutdown":
                                        return [
                                            3,
                                            6
                                        ];
                                }
                                return [
                                    3,
                                    8
                                ];
                            case 1:
                                this.runtime.pause();
                                return [
                                    2,
                                    {
                                        ok: true
                                    }
                                ];
                            case 2:
                                this.runtime.resume();
                                return [
                                    2,
                                    {
                                        ok: true
                                    }
                                ];
                            case 3:
                                this.runtime.setSpeed(params.ticksPerSecond);
                                return [
                                    2,
                                    {
                                        ok: true
                                    }
                                ];
                            case 4:
                                return [
                                    4,
                                    this.persistence.flush(this.runtime.getSnapshot())
                                ];
                            case 5:
                                _state.sent();
                                return [
                                    2,
                                    {
                                        ok: true
                                    }
                                ];
                            case 6:
                                return [
                                    4,
                                    this.persistence.flush(this.runtime.getSnapshot())
                                ];
                            case 7:
                                _state.sent();
                                queueMicrotask(function() {
                                    var _this_onShutdownRequest, _this1;
                                    _this.emit("shutdownRequested");
                                    void ((_this_onShutdownRequest = (_this1 = _this).onShutdownRequest) === null || _this_onShutdownRequest === void 0 ? void 0 : _this_onShutdownRequest.call(_this1));
                                });
                                return [
                                    2,
                                    {
                                        ok: true
                                    }
                                ];
                            case 8:
                                throw errorWithCode(RpcErrorCode.InvalidParams, "Unsupported control op: ".concat(JSON.stringify(params)));
                            case 9:
                                return [
                                    2
                                ];
                        }
                    });
                }).call(this);
            }
        }
    ]);
    return GameDaemonServer;
}(EventEmitter);
