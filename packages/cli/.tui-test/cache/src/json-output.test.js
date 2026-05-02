//# hash=351ee4a24b06b66ff0b0d74b0afc4f9a
//# sourceMappingURL=json-output.test.js.map

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
import { spawn } from "node:child_process";
import { formatJsonError, formatJsonResult } from "./commands/common.js";
test("formatJsonResult uses the standard ok/data envelope", function() {
    assert.equal(formatJsonResult({
        tick: 1
    }), JSON.stringify({
        ok: true,
        data: {
            tick: 1
        }
    }, null, 2));
});
test("formatJsonError uses the standard ok/error envelope", function() {
    assert.equal(formatJsonError("boom"), JSON.stringify({
        ok: false,
        error: {
            code: 1,
            message: "boom"
        }
    }, null, 2));
});
test("cli prints JSON errors when --json is set", function() {
    return _async_to_generator(function() {
        var child, stderr;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    child = spawn(process.execPath, [
                        "--import",
                        "tsx",
                        "src/cli.ts",
                        "speed",
                        "--json"
                    ], {
                        cwd: process.cwd(),
                        stdio: [
                            "ignore",
                            "pipe",
                            "pipe"
                        ]
                    });
                    return [
                        4,
                        new Promise(function(resolve, reject) {
                            var _child_stderr;
                            var output = "";
                            (_child_stderr = child.stderr) === null || _child_stderr === void 0 ? void 0 : _child_stderr.on("data", function(chunk) {
                                output += chunk.toString();
                            });
                            child.once("error", reject);
                            child.once("close", function(code) {
                                if (code === 0) {
                                    reject(new Error("expected non-zero exit"));
                                    return;
                                }
                                resolve(output.trim());
                            });
                        })
                    ];
                case 1:
                    stderr = _state.sent();
                    assert.match(stderr, /"ok": false/);
                    assert.match(stderr, /Usage: dct speed/);
                    return [
                        2
                    ];
            }
        });
    })();
});
