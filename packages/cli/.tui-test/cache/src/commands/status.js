//# hash=7c5feca0c9b71f999bd3dd19550ae2f6
//# sourceMappingURL=status.js.map

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
import { resolvePaths } from "../paths.js";
function getStringFlag(parsed, flag) {
    var value = parsed.flags[flag];
    return typeof value === "string" ? value : undefined;
}
function hasBooleanFlag(parsed, flag) {
    return parsed.flags[flag] === true;
}
function formatMoney(amount) {
    return "$".concat(new Intl.NumberFormat("en-US", {
        minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
        maximumFractionDigits: 2
    }).format(amount));
}
export function formatStatusLine(status) {
    return [
        "tick=".concat(status.tick),
        "cash=".concat(formatMoney(status.cash)),
        "dcs=".concat(status.datacenterCount),
        "racks=".concat(status.rackCount),
        "active=".concat(status.activeContractCount),
        "market=".concat(status.marketContractCount),
        "paused=".concat(status.paused),
        "speed=".concat(status.speedTps)
    ].join(" ");
}
export function formatStatusJson(status) {
    return JSON.stringify({
        ok: true,
        data: status
    }, null, 2);
}
export function runStatusCommand(parsed) {
    var clientFactory = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : function(options) {
        return new DctClient(options);
    };
    return _async_to_generator(function() {
        var paths, client, result, status;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    paths = resolvePaths({
                        saveOverride: getStringFlag(parsed, "--save"),
                        socketOverride: getStringFlag(parsed, "--socket")
                    });
                    client = clientFactory({
                        socketPath: paths.socketPath,
                        savePath: paths.savePath,
                        noDaemon: hasBooleanFlag(parsed, "--no-daemon")
                    });
                    _state.label = 1;
                case 1:
                    _state.trys.push([
                        1,
                        ,
                        4,
                        6
                    ]);
                    return [
                        4,
                        client.connect()
                    ];
                case 2:
                    _state.sent();
                    return [
                        4,
                        client.query({
                            kind: "status"
                        })
                    ];
                case 3:
                    result = _state.sent();
                    status = result;
                    console.log(hasBooleanFlag(parsed, "--json") ? formatStatusJson(status) : formatStatusLine(status));
                    return [
                        3,
                        6
                    ];
                case 4:
                    return [
                        4,
                        client.close()
                    ];
                case 5:
                    _state.sent();
                    return [
                        7
                    ];
                case 6:
                    return [
                        2
                    ];
            }
        });
    })();
}
