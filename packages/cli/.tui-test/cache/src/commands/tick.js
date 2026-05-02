//# hash=fb40e6f589974624f00ed85c9b3504cf
//# sourceMappingURL=tick.js.map

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
import { DctClient } from "../client/client.js";
import { parseInteger, withClient, writeCommandResult } from "./common.js";
export function runTickCommand(parsed) {
    var clientFactory = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : function(options) {
        return new DctClient(options);
    };
    return _async_to_generator(function() {
        var count, status;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    count = parsed.positionals[0] ? parseInteger(parsed.positionals[0], "tick count") : 1;
                    if (count < 0) {
                        throw new Error("Invalid tick count: ".concat(count));
                    }
                    return [
                        4,
                        withClient(parsed, function(client) {
                            return _async_to_generator(function() {
                                var index;
                                return _ts_generator(this, function(_state) {
                                    switch(_state.label){
                                        case 0:
                                            index = 0;
                                            _state.label = 1;
                                        case 1:
                                            if (!(index < count)) return [
                                                3,
                                                4
                                            ];
                                            return [
                                                4,
                                                client.dispatch({
                                                    type: "Tick"
                                                })
                                            ];
                                        case 2:
                                            _state.sent();
                                            _state.label = 3;
                                        case 3:
                                            index += 1;
                                            return [
                                                3,
                                                1
                                            ];
                                        case 4:
                                            return [
                                                4,
                                                client.query({
                                                    kind: "status"
                                                })
                                            ];
                                        case 5:
                                            return [
                                                2,
                                                _state.sent()
                                            ];
                                    }
                                });
                            })();
                        }, clientFactory)
                    ];
                case 1:
                    status = _state.sent();
                    writeCommandResult(parsed, "Advanced ".concat(count, " tick").concat(count === 1 ? "" : "s", " to tick ").concat(status.tick), status);
                    return [
                        2
                    ];
            }
        });
    })();
}
