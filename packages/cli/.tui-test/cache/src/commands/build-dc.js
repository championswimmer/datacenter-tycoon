//# hash=3f362ae0e45b703e5a97b965788ef8a2
//# sourceMappingURL=build-dc.js.map

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
import { createShortId, parseInteger, requirePositional, withClient, writeCommandResult } from "./common.js";
var datacenterId = function datacenterId(value) {
    return value;
};
var datacenterSpecId = function datacenterSpecId(value) {
    return value;
};
var rackPlacementId = function rackPlacementId(value) {
    return value;
};
var rackSpecId = function rackSpecId(value) {
    return value;
};
function getOptionalStringFlag(parsed, flag) {
    var value = parsed.flags[flag];
    return typeof value === "string" ? value : undefined;
}
export function runBuildDatacenterCommand(parsed) {
    var clientFactory = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : function(options) {
        return new DctClient(options);
    };
    return _async_to_generator(function() {
        var _getOptionalStringFlag, specId, dcId;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    specId = requirePositional(parsed, 0, "dct build-dc <specId> [--id <dcId>]");
                    dcId = (_getOptionalStringFlag = getOptionalStringFlag(parsed, "--id")) !== null && _getOptionalStringFlag !== void 0 ? _getOptionalStringFlag : createShortId("dc");
                    return [
                        4,
                        withClient(parsed, function(client) {
                            return _async_to_generator(function() {
                                return _ts_generator(this, function(_state) {
                                    switch(_state.label){
                                        case 0:
                                            return [
                                                4,
                                                client.dispatch({
                                                    type: "BuildDatacenter",
                                                    specId: datacenterSpecId(specId),
                                                    dcId: datacenterId(dcId)
                                                })
                                            ];
                                        case 1:
                                            _state.sent();
                                            return [
                                                2
                                            ];
                                    }
                                });
                            })();
                        }, clientFactory)
                    ];
                case 1:
                    _state.sent();
                    writeCommandResult(parsed, "Built datacenter ".concat(dcId), {
                        dcId: dcId,
                        specId: specId
                    });
                    return [
                        2
                    ];
            }
        });
    })();
}
export function runAddRackCommand(parsed) {
    var clientFactory = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : function(options) {
        return new DctClient(options);
    };
    return _async_to_generator(function() {
        var _getOptionalStringFlag, dcId, row, position, specId, placementId;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    dcId = requirePositional(parsed, 0, "dct add-rack <dcId> <row> <position> <rackSpecId>");
                    row = parseInteger(requirePositional(parsed, 1, "dct add-rack <dcId> <row> <position> <rackSpecId>"), "row");
                    position = parseInteger(requirePositional(parsed, 2, "dct add-rack <dcId> <row> <position> <rackSpecId>"), "position");
                    specId = requirePositional(parsed, 3, "dct add-rack <dcId> <row> <position> <rackSpecId>");
                    placementId = (_getOptionalStringFlag = getOptionalStringFlag(parsed, "--id")) !== null && _getOptionalStringFlag !== void 0 ? _getOptionalStringFlag : createShortId("rp");
                    return [
                        4,
                        withClient(parsed, function(client) {
                            return _async_to_generator(function() {
                                return _ts_generator(this, function(_state) {
                                    switch(_state.label){
                                        case 0:
                                            return [
                                                4,
                                                client.dispatch({
                                                    type: "PlaceRack",
                                                    dcId: datacenterId(dcId),
                                                    specId: rackSpecId(specId),
                                                    row: row,
                                                    position: position,
                                                    placementId: rackPlacementId(placementId)
                                                })
                                            ];
                                        case 1:
                                            _state.sent();
                                            return [
                                                2
                                            ];
                                    }
                                });
                            })();
                        }, clientFactory)
                    ];
                case 1:
                    _state.sent();
                    writeCommandResult(parsed, "Added rack ".concat(placementId), {
                        placementId: placementId,
                        dcId: dcId,
                        specId: specId,
                        row: row,
                        position: position
                    });
                    return [
                        2
                    ];
            }
        });
    })();
}
export function runRemoveRackCommand(parsed) {
    var clientFactory = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : function(options) {
        return new DctClient(options);
    };
    return _async_to_generator(function() {
        var dcId, placementId;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    dcId = requirePositional(parsed, 0, "dct remove-rack <dcId> <placementId>");
                    placementId = requirePositional(parsed, 1, "dct remove-rack <dcId> <placementId>");
                    return [
                        4,
                        withClient(parsed, function(client) {
                            return _async_to_generator(function() {
                                return _ts_generator(this, function(_state) {
                                    switch(_state.label){
                                        case 0:
                                            return [
                                                4,
                                                client.dispatch({
                                                    type: "RemoveRack",
                                                    dcId: datacenterId(dcId),
                                                    placementId: rackPlacementId(placementId)
                                                })
                                            ];
                                        case 1:
                                            _state.sent();
                                            return [
                                                2
                                            ];
                                    }
                                });
                            })();
                        }, clientFactory)
                    ];
                case 1:
                    _state.sent();
                    writeCommandResult(parsed, "Removed rack ".concat(placementId), {
                        dcId: dcId,
                        placementId: placementId
                    });
                    return [
                        2
                    ];
            }
        });
    })();
}
