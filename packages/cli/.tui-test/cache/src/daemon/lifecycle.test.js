//# hash=520bc25cec2f6a9b12c36f8069fa11f6
//# sourceMappingURL=lifecycle.test.js.map

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
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { EventEmitter } from "node:events";
import { newGame } from "@datacenter-tycoon/game-logic";
import { DaemonLifecycle } from "./lifecycle.js";
import { GameRuntime } from "./runtime.js";
var FakeTransport = /*#__PURE__*/ function(EventEmitter) {
    "use strict";
    _inherits(FakeTransport, EventEmitter);
    function FakeTransport() {
        _class_call_check(this, FakeTransport);
        return _call_super(this, FakeTransport, arguments);
    }
    return FakeTransport;
}(EventEmitter);
var FakeSignalProcess = /*#__PURE__*/ function() {
    "use strict";
    function FakeSignalProcess() {
        _class_call_check(this, FakeSignalProcess);
        _define_property(this, "pid", 4242);
        _define_property(this, "emitter", new EventEmitter());
        _define_property(this, "alivePids", new Set());
    }
    _create_class(FakeSignalProcess, [
        {
            key: "on",
            value: function on(event, listener) {
                this.emitter.on(event, listener);
            }
        },
        {
            key: "off",
            value: function off(event, listener) {
                this.emitter.off(event, listener);
            }
        },
        {
            key: "kill",
            value: function kill(pid) {
                if (this.alivePids.has(pid)) {
                    return true;
                }
                var error = new Error("No such process");
                error.code = "ESRCH";
                throw error;
            }
        },
        {
            key: "emitSignal",
            value: function emitSignal(signal) {
                this.emitter.emit(signal);
            }
        }
    ]);
    return FakeSignalProcess;
}();
function createPidPath() {
    var directory = fs.mkdtempSync(path.join(os.tmpdir(), "dct-cli-lifecycle-"));
    return path.join(directory, "dct.pid");
}
test("DaemonLifecycle acquires and releases pid locks", function() {
    return _async_to_generator(function() {
        var transport, signalProcess, started, stopped, lifecycle;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    transport = new FakeTransport();
                    signalProcess = new FakeSignalProcess();
                    started = 0;
                    stopped = 0;
                    lifecycle = new DaemonLifecycle({
                        pidPath: createPidPath(),
                        transport: transport,
                        runtime: new GameRuntime({
                            state: newGame(1),
                            paused: true
                        }),
                        startServer: function startServer() {
                            return _async_to_generator(function() {
                                return _ts_generator(this, function(_state) {
                                    started += 1;
                                    return [
                                        2
                                    ];
                                });
                            })();
                        },
                        stopServer: function stopServer() {
                            return _async_to_generator(function() {
                                return _ts_generator(this, function(_state) {
                                    stopped += 1;
                                    return [
                                        2
                                    ];
                                });
                            })();
                        },
                        signalProcess: signalProcess
                    });
                    return [
                        4,
                        lifecycle.start()
                    ];
                case 1:
                    _state.sent();
                    assert.equal(started, 1);
                    assert.equal(fs.existsSync(lifecycle.pidPath), true);
                    return [
                        4,
                        lifecycle.requestShutdown()
                    ];
                case 2:
                    _state.sent();
                    assert.equal(stopped, 1);
                    assert.equal(fs.existsSync(lifecycle.pidPath), false);
                    return [
                        2
                    ];
            }
        });
    })();
});
test("DaemonLifecycle rejects live pid locks and allows stale ones", function() {
    return _async_to_generator(function() {
        var transport, signalProcess, pidPath, runtime, runningLockLifecycle, staleLockLifecycle;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    transport = new FakeTransport();
                    signalProcess = new FakeSignalProcess();
                    pidPath = createPidPath();
                    fs.writeFileSync(pidPath, "9999\n", "utf8");
                    runtime = new GameRuntime({
                        state: newGame(2),
                        paused: true
                    });
                    signalProcess.alivePids.add(9999);
                    runningLockLifecycle = new DaemonLifecycle({
                        pidPath: pidPath,
                        transport: transport,
                        runtime: runtime,
                        startServer: function startServer() {
                            return _async_to_generator(function() {
                                return _ts_generator(this, function(_state) {
                                    return [
                                        2
                                    ];
                                });
                            })();
                        },
                        stopServer: function stopServer() {
                            return _async_to_generator(function() {
                                return _ts_generator(this, function(_state) {
                                    return [
                                        2
                                    ];
                                });
                            })();
                        },
                        signalProcess: signalProcess
                    });
                    return [
                        4,
                        assert.rejects(function() {
                            return runningLockLifecycle.start();
                        }, /Daemon already running/)
                    ];
                case 1:
                    _state.sent();
                    signalProcess.alivePids.delete(9999);
                    staleLockLifecycle = new DaemonLifecycle({
                        pidPath: pidPath,
                        transport: transport,
                        runtime: runtime,
                        startServer: function startServer() {
                            return _async_to_generator(function() {
                                return _ts_generator(this, function(_state) {
                                    return [
                                        2
                                    ];
                                });
                            })();
                        },
                        stopServer: function stopServer() {
                            return _async_to_generator(function() {
                                return _ts_generator(this, function(_state) {
                                    return [
                                        2
                                    ];
                                });
                            })();
                        },
                        signalProcess: signalProcess
                    });
                    return [
                        4,
                        staleLockLifecycle.start()
                    ];
                case 2:
                    _state.sent();
                    return [
                        4,
                        staleLockLifecycle.requestShutdown()
                    ];
                case 3:
                    _state.sent();
                    return [
                        2
                    ];
            }
        });
    })();
});
test("DaemonLifecycle exits after idle timeout when paused and no clients remain", function() {
    return _async_to_generator(function() {
        var transport, signalProcess, exitedCode, lifecycle;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    transport = new FakeTransport();
                    signalProcess = new FakeSignalProcess();
                    lifecycle = new DaemonLifecycle({
                        pidPath: createPidPath(),
                        idleTimeoutMs: 20,
                        transport: transport,
                        runtime: new GameRuntime({
                            state: newGame(3),
                            paused: true
                        }),
                        startServer: function startServer() {
                            return _async_to_generator(function() {
                                return _ts_generator(this, function(_state) {
                                    return [
                                        2
                                    ];
                                });
                            })();
                        },
                        stopServer: function stopServer() {
                            return _async_to_generator(function() {
                                return _ts_generator(this, function(_state) {
                                    return [
                                        2
                                    ];
                                });
                            })();
                        },
                        exit: function exit(code) {
                            exitedCode = code;
                        },
                        signalProcess: signalProcess
                    });
                    return [
                        4,
                        lifecycle.start()
                    ];
                case 1:
                    _state.sent();
                    return [
                        4,
                        new Promise(function(resolve) {
                            return setTimeout(resolve, 40);
                        })
                    ];
                case 2:
                    _state.sent();
                    assert.equal(exitedCode, 0);
                    return [
                        2
                    ];
            }
        });
    })();
});
test("DaemonLifecycle resets idle timer on connections and signal shutdown", function() {
    return _async_to_generator(function() {
        var transport, signalProcess, stopped, exitCode, lifecycle;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    transport = new FakeTransport();
                    signalProcess = new FakeSignalProcess();
                    stopped = 0;
                    lifecycle = new DaemonLifecycle({
                        pidPath: createPidPath(),
                        idleTimeoutMs: 20,
                        transport: transport,
                        runtime: new GameRuntime({
                            state: newGame(4),
                            paused: true
                        }),
                        startServer: function startServer() {
                            return _async_to_generator(function() {
                                return _ts_generator(this, function(_state) {
                                    return [
                                        2
                                    ];
                                });
                            })();
                        },
                        stopServer: function stopServer() {
                            return _async_to_generator(function() {
                                return _ts_generator(this, function(_state) {
                                    stopped += 1;
                                    return [
                                        2
                                    ];
                                });
                            })();
                        },
                        exit: function exit(code) {
                            exitCode = code;
                        },
                        signalProcess: signalProcess
                    });
                    return [
                        4,
                        lifecycle.start()
                    ];
                case 1:
                    _state.sent();
                    transport.emit("connection", {});
                    return [
                        4,
                        new Promise(function(resolve) {
                            return setTimeout(resolve, 30);
                        })
                    ];
                case 2:
                    _state.sent();
                    assert.equal(exitCode, undefined);
                    transport.emit("disconnect", {});
                    signalProcess.emitSignal("SIGTERM");
                    return [
                        4,
                        new Promise(function(resolve) {
                            return setImmediate(resolve);
                        })
                    ];
                case 3:
                    _state.sent();
                    assert.equal(stopped, 1);
                    assert.equal(exitCode, 0);
                    return [
                        2
                    ];
            }
        });
    })();
});
