//# hash=57b7d19f6e813dd06007147322752a39
//# sourceMappingURL=client.js.map

function _array_like_to_array(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes(arr) {
    if (Array.isArray(arr)) return arr;
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
function _iterable_to_array_limit(arr, i) {
    var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"];
    if (_i == null) return;
    var _arr = [];
    var _n = true;
    var _d = false;
    var _s, _e;
    try {
        for(_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true){
            _arr.push(_s.value);
            if (i && _arr.length === i) break;
        }
    } catch (err) {
        _d = true;
        _e = err;
    } finally{
        try {
            if (!_n && _i["return"] != null) _i["return"]();
        } finally{
            if (_d) throw _e;
        }
    }
    return _arr;
}
function _non_iterable_rest() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _sliced_to_array(arr, i) {
    return _array_with_holes(arr) || _iterable_to_array_limit(arr, i) || _unsupported_iterable_to_array(arr, i) || _non_iterable_rest();
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
import { autoSpawnDaemon } from "./spawn.js";
var CLIENT_VERSION = "0.1.0";
function getMajorVersion(version) {
    var _version_split_;
    return (_version_split_ = version.split(".")[0]) !== null && _version_split_ !== void 0 ? _version_split_ : version;
}
function assertCompatibleVersions(clientVersion, daemonVersion) {
    if (getMajorVersion(clientVersion) === getMajorVersion(daemonVersion)) {
        return;
    }
    throw new Error("Daemon version ".concat(daemonVersion, " is incompatible with client ").concat(clientVersion, ". Upgrade @datacenter-tycoon/cli or restart the daemon."));
}
export var DctClient = /*#__PURE__*/ function() {
    "use strict";
    function DctClient(options) {
        _class_call_check(this, DctClient);
        var _options_clientVersion, _options_noDaemon, _options_autoSpawn;
        _define_property(this, "socketPath", void 0);
        _define_property(this, "savePath", void 0);
        _define_property(this, "clientVersion", void 0);
        _define_property(this, "noDaemon", void 0);
        _define_property(this, "autoSpawn", void 0);
        _define_property(this, "waitForSocketTimeoutMs", void 0);
        _define_property(this, "idleTimeoutMs", void 0);
        _define_property(this, "seed", void 0);
        _define_property(this, "socket", void 0);
        _define_property(this, "spawnedProcess", void 0);
        _define_property(this, "nextRequestId", 1);
        _define_property(this, "buffer", "");
        _define_property(this, "pendingRequests", new Map());
        _define_property(this, "subscriptions", new Map());
        _define_property(this, "connected", false);
        _define_property(this, "handshakePromise", void 0);
        _define_property(this, "helloResult", void 0);
        this.socketPath = options.socketPath;
        this.savePath = options.savePath;
        this.clientVersion = (_options_clientVersion = options.clientVersion) !== null && _options_clientVersion !== void 0 ? _options_clientVersion : CLIENT_VERSION;
        this.noDaemon = (_options_noDaemon = options.noDaemon) !== null && _options_noDaemon !== void 0 ? _options_noDaemon : false;
        this.autoSpawn = (_options_autoSpawn = options.autoSpawn) !== null && _options_autoSpawn !== void 0 ? _options_autoSpawn : true;
        this.waitForSocketTimeoutMs = options.waitForSocketTimeoutMs;
        this.idleTimeoutMs = options.idleTimeoutMs;
        this.seed = options.seed;
    }
    _create_class(DctClient, [
        {
            key: "connect",
            value: function connect() {
                return _async_to_generator(function() {
                    var error, maybeError, isRecoverable, _;
                    return _ts_generator(this, function(_state) {
                        switch(_state.label){
                            case 0:
                                if (this.connected) {
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
                                    6
                                ]);
                                return [
                                    4,
                                    this.connectSocket()
                                ];
                            case 2:
                                _state.sent();
                                return [
                                    3,
                                    6
                                ];
                            case 3:
                                error = _state.sent();
                                maybeError = error;
                                isRecoverable = maybeError.code === "ENOENT" || maybeError.code === "ECONNREFUSED";
                                if (!this.autoSpawn || !isRecoverable) {
                                    throw error;
                                }
                                _ = this;
                                return [
                                    4,
                                    autoSpawnDaemon({
                                        socketPath: this.socketPath,
                                        savePath: this.savePath,
                                        noDaemon: this.noDaemon,
                                        waitForSocketTimeoutMs: this.waitForSocketTimeoutMs,
                                        idleTimeoutMs: this.idleTimeoutMs,
                                        seed: this.seed
                                    })
                                ];
                            case 4:
                                _.spawnedProcess = _state.sent();
                                return [
                                    4,
                                    this.connectSocket()
                                ];
                            case 5:
                                _state.sent();
                                return [
                                    3,
                                    6
                                ];
                            case 6:
                                return [
                                    2
                                ];
                        }
                    });
                }).call(this);
            }
        },
        {
            key: "hello",
            value: function hello(params) {
                return _async_to_generator(function() {
                    var result;
                    return _ts_generator(this, function(_state) {
                        switch(_state.label){
                            case 0:
                                return [
                                    4,
                                    this.request("hello", params)
                                ];
                            case 1:
                                result = _state.sent();
                                assertCompatibleVersions(params.clientVersion, result.daemonVersion);
                                if (params.clientVersion === this.clientVersion) {
                                    this.helloResult = result;
                                }
                                return [
                                    2,
                                    result
                                ];
                        }
                    });
                }).call(this);
            }
        },
        {
            key: "handshake",
            value: function handshake() {
                return _async_to_generator(function() {
                    var _this;
                    return _ts_generator(this, function(_state) {
                        switch(_state.label){
                            case 0:
                                _this = this;
                                if (this.helloResult) {
                                    return [
                                        2,
                                        this.helloResult
                                    ];
                                }
                                if (!this.handshakePromise) {
                                    this.handshakePromise = this.hello({
                                        clientVersion: this.clientVersion
                                    }).finally(function() {
                                        _this.handshakePromise = undefined;
                                    });
                                }
                                return [
                                    4,
                                    this.handshakePromise
                                ];
                            case 1:
                                return [
                                    2,
                                    _state.sent()
                                ];
                        }
                    });
                }).call(this);
            }
        },
        {
            key: "reconnect",
            value: function reconnect() {
                return _async_to_generator(function() {
                    return _ts_generator(this, function(_state) {
                        switch(_state.label){
                            case 0:
                                return [
                                    4,
                                    this.close()
                                ];
                            case 1:
                                _state.sent();
                                return [
                                    4,
                                    this.connect()
                                ];
                            case 2:
                                _state.sent();
                                return [
                                    2
                                ];
                        }
                    });
                }).call(this);
            }
        },
        {
            key: "dispatch",
            value: function dispatch(action) {
                return _async_to_generator(function() {
                    return _ts_generator(this, function(_state) {
                        switch(_state.label){
                            case 0:
                                return [
                                    4,
                                    this.handshake()
                                ];
                            case 1:
                                _state.sent();
                                return [
                                    4,
                                    this.request("dispatch", action)
                                ];
                            case 2:
                                return [
                                    2,
                                    _state.sent()
                                ];
                        }
                    });
                }).call(this);
            }
        },
        {
            key: "query",
            value: function query(params) {
                return _async_to_generator(function() {
                    return _ts_generator(this, function(_state) {
                        switch(_state.label){
                            case 0:
                                return [
                                    4,
                                    this.handshake()
                                ];
                            case 1:
                                _state.sent();
                                return [
                                    4,
                                    this.request("query", params)
                                ];
                            case 2:
                                return [
                                    2,
                                    _state.sent()
                                ];
                        }
                    });
                }).call(this);
            }
        },
        {
            key: "subscribe",
            value: function subscribe(events, onEvent) {
                return _async_to_generator(function() {
                    var _this, result;
                    return _ts_generator(this, function(_state) {
                        switch(_state.label){
                            case 0:
                                _this = this;
                                return [
                                    4,
                                    this.handshake()
                                ];
                            case 1:
                                _state.sent();
                                return [
                                    4,
                                    this.request("subscribe", {
                                        events: events
                                    })
                                ];
                            case 2:
                                result = _state.sent();
                                this.subscriptions.set(result.subId, onEvent);
                                return [
                                    2,
                                    {
                                        subId: result.subId,
                                        unsubscribe: function unsubscribe() {
                                            return _async_to_generator(function() {
                                                return _ts_generator(this, function(_state) {
                                                    switch(_state.label){
                                                        case 0:
                                                            this.subscriptions.delete(result.subId);
                                                            return [
                                                                4,
                                                                this.request("unsubscribe", {
                                                                    subId: result.subId
                                                                })
                                                            ];
                                                        case 1:
                                                            return [
                                                                2,
                                                                _state.sent()
                                                            ];
                                                    }
                                                });
                                            }).call(_this);
                                        }
                                    }
                                ];
                        }
                    });
                }).call(this);
            }
        },
        {
            key: "subscribeState",
            value: function subscribeState(onSnapshot, onDelta) {
                return _async_to_generator(function() {
                    var snapshot;
                    return _ts_generator(this, function(_state) {
                        switch(_state.label){
                            case 0:
                                return [
                                    4,
                                    this.query({
                                        kind: "snapshot"
                                    })
                                ];
                            case 1:
                                snapshot = _state.sent();
                                onSnapshot(snapshot);
                                return [
                                    4,
                                    this.subscribe([
                                        "state",
                                        "tick",
                                        "ledger"
                                    ], function(event) {
                                        if (event.type === "state") {
                                            onSnapshot(event.snapshot);
                                        }
                                        onDelta(event);
                                    })
                                ];
                            case 2:
                                return [
                                    2,
                                    _state.sent()
                                ];
                        }
                    });
                }).call(this);
            }
        },
        {
            key: "control",
            value: function control(params) {
                return _async_to_generator(function() {
                    return _ts_generator(this, function(_state) {
                        switch(_state.label){
                            case 0:
                                return [
                                    4,
                                    this.handshake()
                                ];
                            case 1:
                                _state.sent();
                                return [
                                    4,
                                    this.request("control", params)
                                ];
                            case 2:
                                return [
                                    2,
                                    _state.sent()
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
                    var _this;
                    return _ts_generator(this, function(_state) {
                        switch(_state.label){
                            case 0:
                                _this = this;
                                if (!this.socket) {
                                    return [
                                        2
                                    ];
                                }
                                return [
                                    4,
                                    new Promise(function(resolve) {
                                        var socket = _this.socket;
                                        _this.socket = undefined;
                                        _this.connected = false;
                                        _this.helloResult = undefined;
                                        _this.handshakePromise = undefined;
                                        _this.rejectPendingRequests(new Error("Socket closed"));
                                        socket === null || socket === void 0 ? void 0 : socket.once("close", function() {
                                            return resolve();
                                        });
                                        socket === null || socket === void 0 ? void 0 : socket.end();
                                        socket === null || socket === void 0 ? void 0 : socket.destroy();
                                    })
                                ];
                            case 1:
                                _state.sent();
                                return [
                                    2
                                ];
                        }
                    });
                }).call(this);
            }
        },
        {
            key: "getSpawnedProcess",
            value: function getSpawnedProcess() {
                return this.spawnedProcess;
            }
        },
        {
            key: "request",
            value: function request(method, params) {
                return _async_to_generator(function() {
                    var _this, id, promise;
                    return _ts_generator(this, function(_state) {
                        switch(_state.label){
                            case 0:
                                _this = this;
                                if (!this.socket || !this.connected) {
                                    throw new Error("Client is not connected");
                                }
                                id = this.nextRequestId;
                                this.nextRequestId += 1;
                                promise = new Promise(function(resolve, reject) {
                                    _this.pendingRequests.set(id, {
                                        resolve: resolve,
                                        reject: reject
                                    });
                                });
                                this.socket.write("".concat(JSON.stringify({
                                    jsonrpc: "2.0",
                                    id: id,
                                    method: method,
                                    params: params
                                }), "\n"));
                                return [
                                    4,
                                    promise
                                ];
                            case 1:
                                return [
                                    2,
                                    _state.sent()
                                ];
                        }
                    });
                }).call(this);
            }
        },
        {
            key: "connectSocket",
            value: function connectSocket() {
                return _async_to_generator(function() {
                    var _this;
                    return _ts_generator(this, function(_state) {
                        switch(_state.label){
                            case 0:
                                _this = this;
                                return [
                                    4,
                                    new Promise(function(resolve, reject) {
                                        var socket = net.createConnection(_this.socketPath);
                                        var onError = function onError(error) {
                                            socket.destroy();
                                            reject(error);
                                        };
                                        socket.once("error", onError);
                                        socket.once("connect", function() {
                                            socket.off("error", onError);
                                            _this.socket = socket;
                                            _this.connected = true;
                                            _this.attachSocket(socket);
                                            resolve();
                                        });
                                    })
                                ];
                            case 1:
                                _state.sent();
                                return [
                                    2
                                ];
                        }
                    });
                }).call(this);
            }
        },
        {
            key: "attachSocket",
            value: function attachSocket(socket) {
                var _this = this;
                socket.on("data", function(chunk) {
                    _this.handleData(chunk.toString());
                });
                socket.on("close", function() {
                    _this.connected = false;
                    _this.socket = undefined;
                    _this.helloResult = undefined;
                    _this.handshakePromise = undefined;
                    _this.rejectPendingRequests(new Error("Socket closed"));
                });
                socket.on("error", function(error) {
                    _this.rejectPendingRequests(error);
                });
            }
        },
        {
            key: "handleData",
            value: function handleData(chunk) {
                var _lines_pop;
                this.buffer += chunk;
                var lines = this.buffer.split("\n");
                this.buffer = (_lines_pop = lines.pop()) !== null && _lines_pop !== void 0 ? _lines_pop : "";
                var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                try {
                    for(var _iterator = lines[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                        var line = _step.value;
                        var trimmed = line.trim();
                        if (!trimmed) {
                            continue;
                        }
                        var message = JSON.parse(trimmed);
                        if ("method" in message && message.method === "event") {
                            var handler = this.subscriptions.get(message.params.subId);
                            handler === null || handler === void 0 ? void 0 : handler(message.params.event);
                            continue;
                        }
                        if (!("id" in message)) {
                            continue;
                        }
                        var pendingRequest = this.pendingRequests.get(message.id);
                        if (!pendingRequest) {
                            continue;
                        }
                        this.pendingRequests.delete(message.id);
                        if (message.error) {
                            pendingRequest.reject(new Error(message.error.message));
                            continue;
                        }
                        pendingRequest.resolve(message.result);
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
            key: "rejectPendingRequests",
            value: function rejectPendingRequests(error) {
                var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                try {
                    for(var _iterator = this.pendingRequests[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                        var _step_value = _sliced_to_array(_step.value, 2), id = _step_value[0], pendingRequest = _step_value[1];
                        this.pendingRequests.delete(id);
                        pendingRequest.reject(error);
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
        }
    ]);
    return DctClient;
}();
