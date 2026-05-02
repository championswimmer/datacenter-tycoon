//# hash=70eb583470b6806c9a093c623b2f2f12
//# sourceMappingURL=control.test.js.map

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
import test from "node:test";
import { parseArgv } from "../argv.js";
import { runPauseCommand, runResumeCommand, runSpeedCommand } from "./control.js";
function createFakeClient(log) {
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
                    return [
                        2,
                        {
                            tick: 0
                        }
                    ];
                });
            })();
        },
        query: function query() {
            return _async_to_generator(function() {
                return _ts_generator(this, function(_state) {
                    log.push("query:status");
                    return [
                        2,
                        {
                            tick: 3,
                            paused: false,
                            speedTps: 4,
                            cash: 100,
                            datacenterCount: 1,
                            rackCount: 1,
                            activeContractCount: 0,
                            marketContractCount: 2
                        }
                    ];
                });
            })();
        },
        control: function control(params) {
            return _async_to_generator(function() {
                return _ts_generator(this, function(_state) {
                    log.push("control:".concat(params.op).concat("ticksPerSecond" in params ? ":".concat(params.ticksPerSecond) : ""));
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
test("runPauseCommand sends pause and queries status", function() {
    return _async_to_generator(function() {
        var log;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    log = [];
                    return [
                        4,
                        runPauseCommand(parseArgv([
                            "pause",
                            "--quiet"
                        ]), function() {
                            return createFakeClient(log);
                        })
                    ];
                case 1:
                    _state.sent();
                    assert.deepEqual(log, [
                        "connect",
                        "control:pause",
                        "query:status",
                        "close"
                    ]);
                    return [
                        2
                    ];
            }
        });
    })();
});
test("runResumeCommand sends resume and queries status", function() {
    return _async_to_generator(function() {
        var log;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    log = [];
                    return [
                        4,
                        runResumeCommand(parseArgv([
                            "resume",
                            "--quiet"
                        ]), function() {
                            return createFakeClient(log);
                        })
                    ];
                case 1:
                    _state.sent();
                    assert.deepEqual(log, [
                        "connect",
                        "control:resume",
                        "query:status",
                        "close"
                    ]);
                    return [
                        2
                    ];
            }
        });
    })();
});
test("runSpeedCommand sends set-speed and validates input", function() {
    return _async_to_generator(function() {
        var log;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    log = [];
                    return [
                        4,
                        runSpeedCommand(parseArgv([
                            "speed",
                            "8",
                            "--quiet"
                        ]), function() {
                            return createFakeClient(log);
                        })
                    ];
                case 1:
                    _state.sent();
                    assert.deepEqual(log, [
                        "connect",
                        "control:set-speed:8",
                        "query:status",
                        "close"
                    ]);
                    return [
                        4,
                        assert.rejects(function() {
                            return runSpeedCommand(parseArgv([
                                "speed"
                            ]));
                        }, /Usage: dct speed/)
                    ];
                case 2:
                    _state.sent();
                    return [
                        2
                    ];
            }
        });
    })();
});
