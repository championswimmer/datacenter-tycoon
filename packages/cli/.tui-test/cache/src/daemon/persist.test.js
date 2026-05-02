//# hash=7d41f8ee3c613188f4e06bf0c72bb85b
//# sourceMappingURL=persist.test.js.map

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
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { DATACENTER_CATALOG, RACK_CATALOG, reduce } from "@datacenter-tycoon/game-logic";
import { GamePersistence, loadOrInit } from "./persist.js";
var datacenterId = function datacenterId(value) {
    return value;
};
var rackPlacementId = function rackPlacementId(value) {
    return value;
};
function createTempSavePath() {
    var tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "dct-cli-persist-"));
    return path.join(tempDirectory, "save.json");
}
function createState(seed) {
    var state = loadOrInit("/path/that/does/not/exist.json", seed);
    state = reduce(state, {
        type: "BuildDatacenter",
        specId: DATACENTER_CATALOG.garage.id,
        dcId: datacenterId("dc-1")
    });
    state = reduce(state, {
        type: "PlaceRack",
        dcId: datacenterId("dc-1"),
        specId: RACK_CATALOG.C1.id,
        row: 0,
        position: 0,
        placementId: rackPlacementId("rp-1")
    });
    return reduce(state, {
        type: "Tick"
    });
}
test("loadOrInit returns a new game when no savefile exists", function() {
    var savePath = createTempSavePath();
    var state = loadOrInit(savePath, 123);
    assert.equal(state.seed, 123);
    assert.equal(state.tick, 0);
    assert.equal(state.contractMarket.length > 0, true);
});
test("GamePersistence flushSync round-trips state through the savefile", function() {
    var savePath = createTempSavePath();
    var originalState = createState(42);
    var persistence = new GamePersistence({
        savePath: savePath
    });
    persistence.flushSync(originalState);
    var reloadedState = loadOrInit(savePath, 999);
    assert.deepEqual(reloadedState, originalState);
    assert.equal(fs.existsSync("".concat(savePath, ".tmp")), false);
});
test("GamePersistence scheduleAutosave debounces writes and persists the latest snapshot", function() {
    return _async_to_generator(function() {
        var savePath, persistence, firstState, secondState, reloadedState;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    savePath = createTempSavePath();
                    persistence = new GamePersistence({
                        savePath: savePath,
                        debounceMs: 20
                    });
                    firstState = createState(1);
                    secondState = reduce(createState(2), {
                        type: "Tick"
                    });
                    persistence.scheduleAutosave(firstState);
                    persistence.scheduleAutosave(secondState);
                    return [
                        4,
                        sleep(50)
                    ];
                case 1:
                    _state.sent();
                    return [
                        4,
                        persistence.waitForPendingFlush()
                    ];
                case 2:
                    _state.sent();
                    reloadedState = loadOrInit(savePath, 999);
                    assert.deepEqual(reloadedState, secondState);
                    return [
                        2
                    ];
            }
        });
    })();
});
