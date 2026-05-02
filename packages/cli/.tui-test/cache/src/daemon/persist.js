//# hash=6bc34fd81c59fa79013ce934658b9194
//# sourceMappingURL=persist.js.map

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
import fs from "node:fs";
import path from "node:path";
import { deserialize, newGame, serialize } from "@datacenter-tycoon/game-logic";
var DEFAULT_DEBOUNCE_MS = 500;
var defaultScheduler = {
    setTimeout: function setTimeout(callback, delayMs) {
        return globalThis.setTimeout(callback, delayMs);
    },
    clearTimeout: function clearTimeout(handle) {
        return globalThis.clearTimeout(handle);
    }
};
function getTempSavePath(savePath) {
    return "".concat(savePath, ".tmp");
}
function writeAtomic(savePath, state) {
    return _async_to_generator(function() {
        var directory, tempPath;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    directory = path.dirname(savePath);
                    tempPath = getTempSavePath(savePath);
                    return [
                        4,
                        fs.promises.mkdir(directory, {
                            recursive: true
                        })
                    ];
                case 1:
                    _state.sent();
                    return [
                        4,
                        fs.promises.writeFile(tempPath, serialize(state), "utf8")
                    ];
                case 2:
                    _state.sent();
                    return [
                        4,
                        fs.promises.rename(tempPath, savePath)
                    ];
                case 3:
                    _state.sent();
                    return [
                        2
                    ];
            }
        });
    })();
}
function writeAtomicSync(savePath, state) {
    var directory = path.dirname(savePath);
    var tempPath = getTempSavePath(savePath);
    fs.mkdirSync(directory, {
        recursive: true
    });
    fs.writeFileSync(tempPath, serialize(state), "utf8");
    fs.renameSync(tempPath, savePath);
}
export function loadOrInit(savePath, seed) {
    if (!fs.existsSync(savePath)) {
        return newGame(seed);
    }
    return deserialize(fs.readFileSync(savePath, "utf8"));
}
export var GamePersistence = /*#__PURE__*/ function() {
    "use strict";
    function GamePersistence(options) {
        _class_call_check(this, GamePersistence);
        var _options_debounceMs, _options_scheduler;
        _define_property(this, "savePath", void 0);
        _define_property(this, "debounceMs", void 0);
        _define_property(this, "scheduler", void 0);
        _define_property(this, "timeoutHandle", void 0);
        _define_property(this, "pendingState", void 0);
        _define_property(this, "pendingFlush", void 0);
        this.savePath = options.savePath;
        this.debounceMs = (_options_debounceMs = options.debounceMs) !== null && _options_debounceMs !== void 0 ? _options_debounceMs : DEFAULT_DEBOUNCE_MS;
        this.scheduler = (_options_scheduler = options.scheduler) !== null && _options_scheduler !== void 0 ? _options_scheduler : defaultScheduler;
    }
    _create_class(GamePersistence, [
        {
            key: "scheduleAutosave",
            value: function scheduleAutosave(state) {
                var _this = this;
                this.pendingState = state;
                this.clearScheduledFlush();
                this.timeoutHandle = this.scheduler.setTimeout(function() {
                    _this.timeoutHandle = undefined;
                    _this.pendingFlush = _this.flush();
                }, this.debounceMs);
            }
        },
        {
            key: "flush",
            value: function flush() {
                return _async_to_generator(function() {
                    var _this, state, flushPromise;
                    var _arguments = arguments;
                    return _ts_generator(this, function(_state) {
                        switch(_state.label){
                            case 0:
                                _this = this;
                                state = _arguments.length > 0 && _arguments[0] !== void 0 ? _arguments[0] : this.pendingState;
                                this.clearScheduledFlush();
                                if (!state) {
                                    return [
                                        2
                                    ];
                                }
                                this.pendingState = state;
                                flushPromise = writeAtomic(this.savePath, state).then(function() {
                                    if (_this.pendingState === state) {
                                        _this.pendingState = undefined;
                                    }
                                });
                                this.pendingFlush = flushPromise;
                                return [
                                    4,
                                    flushPromise
                                ];
                            case 1:
                                _state.sent();
                                return [
                                    2
                                ];
                        }
                    });
                }).apply(this, arguments);
            }
        },
        {
            key: "flushSync",
            value: function flushSync() {
                var state = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : this.pendingState;
                this.clearScheduledFlush();
                if (!state) {
                    return;
                }
                writeAtomicSync(this.savePath, state);
                if (this.pendingState === state) {
                    this.pendingState = undefined;
                }
            }
        },
        {
            key: "waitForPendingFlush",
            value: function waitForPendingFlush() {
                return _async_to_generator(function() {
                    return _ts_generator(this, function(_state) {
                        switch(_state.label){
                            case 0:
                                return [
                                    4,
                                    this.pendingFlush
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
            key: "clearScheduledFlush",
            value: function clearScheduledFlush() {
                if (this.timeoutHandle === undefined) {
                    return;
                }
                this.scheduler.clearTimeout(this.timeoutHandle);
                this.timeoutHandle = undefined;
            }
        }
    ]);
    return GamePersistence;
}();
