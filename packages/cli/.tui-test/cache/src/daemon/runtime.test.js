//# hash=f61411c6fae1cd7506cd241b06dfb018
//# sourceMappingURL=runtime.test.js.map

function _array_like_to_array(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes(arr) {
    if (Array.isArray(arr)) return _array_like_to_array(arr);
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
function _iterable_to_array(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter);
}
function _non_iterable_spread() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _to_consumable_array(arr) {
    return _array_without_holes(arr) || _iterable_to_array(arr) || _unsupported_iterable_to_array(arr) || _non_iterable_spread();
}
function _unsupported_iterable_to_array(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array(o, minLen);
}
import assert from "node:assert/strict";
import test from "node:test";
import { DATACENTER_CATALOG, RACK_CATALOG, newGame, reduce } from "@datacenter-tycoon/game-logic";
import { GameRuntime } from "./runtime.js";
var datacenterId = function datacenterId(value) {
    return value;
};
var rackPlacementId = function rackPlacementId(value) {
    return value;
};
var FakeScheduler = /*#__PURE__*/ function() {
    "use strict";
    function FakeScheduler() {
        _class_call_check(this, FakeScheduler);
        _define_property(this, "nextHandleId", 1);
        _define_property(this, "intervals", new Map());
        _define_property(this, "setCalls", []);
        _define_property(this, "clearedHandles", []);
    }
    _create_class(FakeScheduler, [
        {
            key: "setInterval",
            value: function setInterval(callback, delayMs) {
                var handleId = this.nextHandleId;
                this.nextHandleId += 1;
                this.intervals.set(handleId, {
                    callback: callback,
                    delayMs: delayMs
                });
                this.setCalls.push(delayMs);
                return handleId;
            }
        },
        {
            key: "clearInterval",
            value: function clearInterval(handle) {
                var handleId = handle;
                if (this.intervals.delete(handleId)) {
                    this.clearedHandles.push(handleId);
                }
            }
        },
        {
            key: "triggerLatest",
            value: function triggerLatest() {
                var _Math;
                var latestHandle = (_Math = Math).max.apply(_Math, _to_consumable_array(this.intervals.keys()));
                var interval = this.intervals.get(latestHandle);
                if (!interval) {
                    throw new Error("No interval registered");
                }
                interval.callback();
            }
        }
    ]);
    return FakeScheduler;
}();
function buildState() {
    var state = newGame(42, {
        startingCash: 3000000
    });
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
    return state;
}
test("GameRuntime dispatching Tick advances state and emits runtime events", function() {
    var runtime = new GameRuntime({
        state: buildState()
    });
    var tickEvents = [];
    var stateEvents = [];
    var ledgerEventCounts = [];
    runtime.on("tick", function(event) {
        tickEvents.push(event.tick);
    });
    runtime.on("state", function(event) {
        stateEvents.push(event.tick);
    });
    runtime.on("ledger", function(event) {
        ledgerEventCounts.push(event.entries.length);
    });
    var nextState = runtime.dispatch({
        type: "Tick"
    });
    assert.equal(nextState.tick, 1);
    assert.deepEqual(tickEvents, [
        1
    ]);
    assert.deepEqual(stateEvents, [
        1
    ]);
    assert.deepEqual(ledgerEventCounts, [
        1
    ]);
    assert.equal(runtime.getSnapshot().tick, 1);
    assert.equal(runtime.getStatus().rackCount, 1);
});
test("GameRuntime setSpeed reschedules the tick loop and interval callbacks tick the game", function() {
    var scheduler = new FakeScheduler();
    var runtime = new GameRuntime({
        state: newGame(7),
        scheduler: scheduler
    });
    runtime.start();
    assert.deepEqual(scheduler.setCalls, [
        1000
    ]);
    runtime.setSpeed(4);
    assert.deepEqual(scheduler.setCalls, [
        1000,
        250
    ]);
    assert.equal(scheduler.clearedHandles.length, 1);
    scheduler.triggerLatest();
    assert.equal(runtime.getSnapshot().tick, 1);
});
test("GameRuntime pause, resume, and tickNow cooperate with zero-speed scheduling", function() {
    var scheduler = new FakeScheduler();
    var runtime = new GameRuntime({
        state: newGame(9),
        scheduler: scheduler,
        initialSpeedTps: 2
    });
    runtime.start();
    assert.deepEqual(scheduler.setCalls, [
        500
    ]);
    assert.deepEqual(runtime.pause(), {
        paused: true,
        speedTps: 2
    });
    assert.equal(scheduler.intervals.size, 0);
    var pausedTick = runtime.tickNow(2);
    assert.equal(pausedTick.tick, 2);
    assert.deepEqual(runtime.setSpeed(0), {
        paused: true,
        speedTps: 0
    });
    assert.equal(scheduler.intervals.size, 0);
    assert.deepEqual(runtime.resume(), {
        paused: false,
        speedTps: 2
    });
    assert.equal(scheduler.setCalls.at(-1), 500);
});
test("GameRuntime query returns status, catalogs, and derived listings", function() {
    var _datacenters_items_, _datacenters_items_1, _racks_items_;
    var runtime = new GameRuntime({
        state: buildState(),
        paused: true
    });
    var status = runtime.query({
        kind: "status"
    });
    assert.equal(status.tick, 0);
    assert.equal(status.datacenterCount, 1);
    assert.equal(status.rackCount, 1);
    assert.equal(status.paused, true);
    var datacenters = runtime.query({
        kind: "list",
        target: "datacenters"
    });
    assert.equal(datacenters.kind, "datacenters");
    assert.equal((_datacenters_items_ = datacenters.items[0]) === null || _datacenters_items_ === void 0 ? void 0 : _datacenters_items_.slotsUsed, 1);
    assert.equal((_datacenters_items_1 = datacenters.items[0]) === null || _datacenters_items_1 === void 0 ? void 0 : _datacenters_items_1.capacity.vCpu, RACK_CATALOG.C1.vCpu);
    var racks = runtime.query({
        kind: "list",
        target: "racks",
        dcId: "dc-1"
    });
    assert.equal(racks.kind, "racks");
    assert.equal((_racks_items_ = racks.items[0]) === null || _racks_items_ === void 0 ? void 0 : _racks_items_.spec.id, RACK_CATALOG.C1.id);
    var catalog = runtime.query({
        kind: "catalog",
        target: "racks"
    });
    assert.equal(catalog.kind, "racks");
    assert.ok(catalog.items.length >= 1);
});
