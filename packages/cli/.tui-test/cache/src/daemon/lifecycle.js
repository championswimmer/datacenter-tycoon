//# hash=2d68999ffd8f859c90712c24c152932e
//# sourceMappingURL=lifecycle.js.map

function _array_like_to_array(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes(arr) {
    if (Array.isArray(arr)) return arr;
}
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
function _sliced_to_array(arr, i) {
    return _array_with_holes(arr) || _iterable_to_array_limit(arr, i) || _unsupported_iterable_to_array(arr, i) || _non_iterable_rest();
}
function _type_of(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
function _unsupported_iterable_to_array(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array(o, minLen);
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
import fs from "node:fs";
import path from "node:path";
import { EventEmitter, once } from "node:events";
var DEFAULT_IDLE_TIMEOUT_MS = 10 * 60 * 1000;
export var DaemonLifecycle = /*#__PURE__*/ function(EventEmitter) {
    "use strict";
    _inherits(DaemonLifecycle, EventEmitter);
    function DaemonLifecycle(options) {
        _class_call_check(this, DaemonLifecycle);
        var _this;
        var _options_idleTimeoutMs, _options_signalProcess;
        _this = _call_super(this, DaemonLifecycle), _define_property(_this, "pidPath", void 0), _define_property(_this, "idleTimeoutMs", void 0), _define_property(_this, "transport", void 0), _define_property(_this, "runtime", void 0), _define_property(_this, "startServer", void 0), _define_property(_this, "stopServer", void 0), _define_property(_this, "exitFn", void 0), _define_property(_this, "signalProcess", void 0), _define_property(_this, "registeredSignals", [
            "SIGINT",
            "SIGTERM"
        ]), _define_property(_this, "clientCount", 0), _define_property(_this, "idleTimer", void 0), _define_property(_this, "started", false), _define_property(_this, "shutdownPromise", void 0), _define_property(_this, "handleConnection", function(_connection) {
            _this.clientCount += 1;
            _this.refreshIdleTimer();
        }), _define_property(_this, "handleDisconnect", function(_connection) {
            _this.clientCount = Math.max(0, _this.clientCount - 1);
            _this.refreshIdleTimer();
        }), _define_property(_this, "handleStatusChange", function(_status) {
            _this.refreshIdleTimer();
        }), _define_property(_this, "handleSignal", function() {
            void _this.requestShutdown(0);
        });
        _this.pidPath = options.pidPath;
        _this.idleTimeoutMs = (_options_idleTimeoutMs = options.idleTimeoutMs) !== null && _options_idleTimeoutMs !== void 0 ? _options_idleTimeoutMs : DEFAULT_IDLE_TIMEOUT_MS;
        _this.transport = options.transport;
        _this.runtime = options.runtime;
        _this.startServer = options.startServer;
        _this.stopServer = options.stopServer;
        _this.exitFn = options.exit;
        _this.signalProcess = (_options_signalProcess = options.signalProcess) !== null && _options_signalProcess !== void 0 ? _options_signalProcess : process;
        return _this;
    }
    _create_class(DaemonLifecycle, [
        {
            key: "start",
            value: function start() {
                return _async_to_generator(function() {
                    var _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, signal, error;
                    return _ts_generator(this, function(_state) {
                        switch(_state.label){
                            case 0:
                                if (this.started) {
                                    return [
                                        2
                                    ];
                                }
                                this.acquirePidLock();
                                this.transport.on("connection", this.handleConnection);
                                this.transport.on("disconnect", this.handleDisconnect);
                                this.runtime.on("status", this.handleStatusChange);
                                _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                                try {
                                    for(_iterator = this.registeredSignals[Symbol.iterator](); !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                                        signal = _step.value;
                                        this.signalProcess.on(signal, this.handleSignal);
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
                                    this.startServer()
                                ];
                            case 2:
                                _state.sent();
                                this.started = true;
                                this.refreshIdleTimer();
                                return [
                                    3,
                                    4
                                ];
                            case 3:
                                error = _state.sent();
                                this.detachListeners();
                                this.releasePidLock();
                                throw error;
                            case 4:
                                return [
                                    2
                                ];
                        }
                    });
                }).call(this);
            }
        },
        {
            key: "requestShutdown",
            value: function requestShutdown() {
                var code = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 0;
                return _async_to_generator(function() {
                    return _ts_generator(this, function(_state) {
                        switch(_state.label){
                            case 0:
                                if (!this.shutdownPromise) {
                                    this.shutdownPromise = this.shutdown(code);
                                }
                                return [
                                    4,
                                    this.shutdownPromise
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
            key: "shutdown",
            value: function shutdown(code) {
                return _async_to_generator(function() {
                    var _this_exitFn, _this;
                    return _ts_generator(this, function(_state) {
                        switch(_state.label){
                            case 0:
                                this.clearIdleTimer();
                                if (!this.started) return [
                                    3,
                                    2
                                ];
                                return [
                                    4,
                                    this.stopServer()
                                ];
                            case 1:
                                _state.sent();
                                this.started = false;
                                _state.label = 2;
                            case 2:
                                this.detachListeners();
                                this.releasePidLock();
                                this.emit("exit", code);
                                (_this_exitFn = (_this = this).exitFn) === null || _this_exitFn === void 0 ? void 0 : _this_exitFn.call(_this, code);
                                return [
                                    2
                                ];
                        }
                    });
                }).call(this);
            }
        },
        {
            key: "refreshIdleTimer",
            value: function refreshIdleTimer() {
                var _this = this;
                this.clearIdleTimer();
                var status = this.runtime.getRuntimeStatus();
                if (!this.started || this.clientCount > 0 || !status.paused) {
                    return;
                }
                this.idleTimer = setTimeout(function() {
                    void _this.requestShutdown(0);
                }, this.idleTimeoutMs);
            }
        },
        {
            key: "clearIdleTimer",
            value: function clearIdleTimer() {
                if (this.idleTimer !== undefined) {
                    clearTimeout(this.idleTimer);
                    this.idleTimer = undefined;
                }
            }
        },
        {
            key: "acquirePidLock",
            value: function acquirePidLock() {
                fs.mkdirSync(path.dirname(this.pidPath), {
                    recursive: true
                });
                if (fs.existsSync(this.pidPath)) {
                    var pidText = fs.readFileSync(this.pidPath, "utf8").trim();
                    var existingPid = Number.parseInt(pidText, 10);
                    if (Number.isFinite(existingPid) && this.isProcessAlive(existingPid)) {
                        throw new Error("Daemon already running with pid ".concat(existingPid));
                    }
                    fs.rmSync(this.pidPath, {
                        force: true
                    });
                }
                fs.writeFileSync(this.pidPath, "".concat(this.signalProcess.pid, "\n"), "utf8");
            }
        },
        {
            key: "isProcessAlive",
            value: function isProcessAlive(pid) {
                try {
                    this.signalProcess.kill(pid, 0);
                    return true;
                } catch (error) {
                    var maybeError = error;
                    if (maybeError.code === "ESRCH") {
                        return false;
                    }
                    throw error;
                }
            }
        },
        {
            key: "releasePidLock",
            value: function releasePidLock() {
                if (!fs.existsSync(this.pidPath)) {
                    return;
                }
                var currentPid = fs.readFileSync(this.pidPath, "utf8").trim();
                if (currentPid === "".concat(this.signalProcess.pid)) {
                    fs.rmSync(this.pidPath, {
                        force: true
                    });
                }
            }
        },
        {
            key: "detachListeners",
            value: function detachListeners() {
                this.transport.off("connection", this.handleConnection);
                this.transport.off("disconnect", this.handleDisconnect);
                this.runtime.off("status", this.handleStatusChange);
                var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                try {
                    for(var _iterator = this.registeredSignals[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                        var signal = _step.value;
                        this.signalProcess.off(signal, this.handleSignal);
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
    return DaemonLifecycle;
}(EventEmitter);
export function waitForExit(lifecycle) {
    return _async_to_generator(function() {
        var _ref, code;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    return [
                        4,
                        once(lifecycle, "exit")
                    ];
                case 1:
                    _ref = _sliced_to_array.apply(void 0, [
                        _state.sent(),
                        1
                    ]), code = _ref[0];
                    return [
                        2,
                        code
                    ];
            }
        });
    })();
}
