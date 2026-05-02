//# hash=963dd1b376ef0beff37b4fcd76c12525
//# sourceMappingURL=runtime.js.map

function _assert_this_initialized(self) {
    if (self === void 0) {
        throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }
    return self;
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
function _object_spread(target) {
    for(var i = 1; i < arguments.length; i++){
        var source = arguments[i] != null ? arguments[i] : {};
        var ownKeys = Object.keys(source);
        if (typeof Object.getOwnPropertySymbols === "function") {
            ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function(sym) {
                return Object.getOwnPropertyDescriptor(source, sym).enumerable;
            }));
        }
        ownKeys.forEach(function(key) {
            _define_property(target, key, source[key]);
        });
    }
    return target;
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
import { EventEmitter } from "node:events";
import { DATACENTER_CATALOG, RACK_CATALOG, datacenterCapacity, datacenterUsage, reduce, VERSION } from "@datacenter-tycoon/game-logic";
var DEFAULT_SPEED_TPS = 1;
var defaultScheduler = {
    setInterval: function setInterval(callback, delayMs) {
        return globalThis.setInterval(callback, delayMs);
    },
    clearInterval: function clearInterval(handle) {
        return globalThis.clearInterval(handle);
    }
};
function assertValidSpeed(ticksPerSecond) {
    if (!Number.isFinite(ticksPerSecond) || ticksPerSecond < 0) {
        throw new Error("Invalid tick speed: ".concat(ticksPerSecond));
    }
}
function totalRackCount(datacenters) {
    return datacenters.reduce(function(count, datacenter) {
        return count + datacenter.placements.length;
    }, 0);
}
function createStatusView(state, runtimeStatus) {
    return _object_spread({
        tick: state.tick,
        cash: state.player.cash,
        datacenterCount: state.datacenters.length,
        rackCount: totalRackCount(state.datacenters),
        activeContractCount: state.activeContracts.length,
        marketContractCount: state.contractMarket.length
    }, runtimeStatus);
}
function createDatacenterList(state) {
    return state.datacenters.map(function(datacenter) {
        var capacity = datacenterCapacity(datacenter);
        var usage = datacenterUsage(datacenter);
        return {
            datacenter: datacenter,
            capacity: capacity,
            powerKw: usage.powerKw,
            powerCapacityKw: datacenter.spec.powerCapacityKw,
            heatOutputBtuPerHr: usage.heatOutputBtuPerHr,
            coolingCapacityBtuPerHr: datacenter.spec.coolingCapacityBtuPerHr,
            bandwidthGbps: usage.bandwidthGbps,
            bandwidthCapacityGbps: datacenter.spec.bandwidthGbps,
            slotsUsed: usage.slotsUsed,
            totalSlots: datacenter.spec.rows * datacenter.spec.positionsPerRow
        };
    });
}
function getDatacenter(state, dcId) {
    var datacenter = state.datacenters.find(function(candidate) {
        return candidate.id === dcId;
    });
    if (!datacenter) {
        throw new Error("Unknown datacenter: ".concat(dcId));
    }
    return datacenter;
}
function getRackSpec(specId) {
    var spec = RACK_CATALOG[specId];
    if (!spec) {
        throw new Error("Unknown rack spec: ".concat(specId));
    }
    return spec;
}
function assertNever(value, context) {
    throw new Error("".concat(context, ": ").concat(JSON.stringify(value)));
}
function createListResult(state, query) {
    switch(query.target){
        case "datacenters":
            return {
                kind: "datacenters",
                items: createDatacenterList(state)
            };
        case "racks":
            {
                if (!query.dcId) {
                    throw new Error("dcId is required when listing racks");
                }
                var datacenter = getDatacenter(state, query.dcId);
                return {
                    kind: "racks",
                    dcId: query.dcId,
                    items: datacenter.placements.map(function(placement) {
                        return {
                            dcId: datacenter.id,
                            dcName: datacenter.name,
                            placementId: placement.id,
                            spec: getRackSpec(placement.specId),
                            row: placement.row,
                            position: placement.position,
                            installedAtTick: placement.installedAtTick
                        };
                    })
                };
            }
        case "market-contracts":
            return {
                kind: "market-contracts",
                items: state.contractMarket
            };
        case "active-contracts":
            return {
                kind: "active-contracts",
                items: state.activeContracts
            };
        default:
            return assertNever(query.target, "Unsupported list target");
    }
}
export var GameRuntime = /*#__PURE__*/ function(EventEmitter) {
    "use strict";
    _inherits(GameRuntime, EventEmitter);
    function GameRuntime(options) {
        _class_call_check(this, GameRuntime);
        var _this;
        var _options_initialSpeedTps, _options_scheduler, _options_paused;
        _this = _call_super(this, GameRuntime), _define_property(_this, "state", void 0), _define_property(_this, "scheduler", void 0), _define_property(_this, "speedTps", void 0), _define_property(_this, "lastActiveSpeedTps", void 0), _define_property(_this, "paused", void 0), _define_property(_this, "timerHandle", void 0), _define_property(_this, "started", false);
        var initialSpeedTps = (_options_initialSpeedTps = options.initialSpeedTps) !== null && _options_initialSpeedTps !== void 0 ? _options_initialSpeedTps : DEFAULT_SPEED_TPS;
        assertValidSpeed(initialSpeedTps);
        _this.state = options.state;
        _this.scheduler = (_options_scheduler = options.scheduler) !== null && _options_scheduler !== void 0 ? _options_scheduler : defaultScheduler;
        _this.speedTps = initialSpeedTps;
        _this.lastActiveSpeedTps = initialSpeedTps > 0 ? initialSpeedTps : DEFAULT_SPEED_TPS;
        _this.paused = (_options_paused = options.paused) !== null && _options_paused !== void 0 ? _options_paused : false;
        return _this;
    }
    _create_class(GameRuntime, [
        {
            key: "start",
            value: function start() {
                if (this.started) {
                    return this;
                }
                this.started = true;
                this.syncTimer();
                return this;
            }
        },
        {
            key: "stop",
            value: function stop() {
                this.started = false;
                this.clearTimer();
            }
        },
        {
            key: "dispatch",
            value: function dispatch(action) {
                var previousState = this.state;
                var nextState = reduce(previousState, action);
                var newLedgerEntries = nextState.ledger.slice(previousState.ledger.length);
                this.state = nextState;
                if (nextState.tick !== previousState.tick) {
                    this.emit("tick", {
                        type: "tick",
                        tick: nextState.tick
                    });
                }
                if (newLedgerEntries.length > 0) {
                    this.emit("ledger", {
                        type: "ledger",
                        tick: nextState.tick,
                        entries: newLedgerEntries
                    });
                }
                this.emit("state", _object_spread({
                    type: "state",
                    tick: nextState.tick,
                    snapshot: nextState
                }, this.getRuntimeStatus()));
                return nextState;
            }
        },
        {
            key: "query",
            value: function query(query) {
                switch(query.kind){
                    case "snapshot":
                        return this.getSnapshot();
                    case "status":
                        return this.getStatus();
                    case "list":
                        return createListResult(this.state, query);
                    case "catalog":
                        return query.target === "datacenters" ? {
                            kind: "datacenters",
                            items: Object.values(DATACENTER_CATALOG)
                        } : {
                            kind: "racks",
                            items: Object.values(RACK_CATALOG)
                        };
                    default:
                        return assertNever(query, "Unsupported query kind");
                }
            }
        },
        {
            key: "setSpeed",
            value: function setSpeed(ticksPerSecond) {
                assertValidSpeed(ticksPerSecond);
                if (ticksPerSecond === 0) {
                    if (this.speedTps > 0) {
                        this.lastActiveSpeedTps = this.speedTps;
                    }
                    this.speedTps = 0;
                    this.paused = true;
                    this.syncTimer();
                    return this.emitStatus();
                }
                this.speedTps = ticksPerSecond;
                this.lastActiveSpeedTps = ticksPerSecond;
                this.paused = false;
                this.syncTimer();
                return this.emitStatus();
            }
        },
        {
            key: "pause",
            value: function pause() {
                this.paused = true;
                this.syncTimer();
                return this.emitStatus();
            }
        },
        {
            key: "resume",
            value: function resume() {
                if (this.speedTps === 0) {
                    this.speedTps = this.lastActiveSpeedTps;
                }
                this.paused = false;
                this.syncTimer();
                return this.emitStatus();
            }
        },
        {
            key: "tickNow",
            value: function tickNow() {
                var count = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 1;
                if (!Number.isInteger(count) || count < 0) {
                    throw new Error("Invalid tick count: ".concat(count));
                }
                var state = this.state;
                for(var index = 0; index < count; index += 1){
                    state = this.dispatch({
                        type: "Tick"
                    });
                }
                return state;
            }
        },
        {
            key: "getSnapshot",
            value: function getSnapshot() {
                return this.state;
            }
        },
        {
            key: "getStatus",
            value: function getStatus() {
                return createStatusView(this.state, this.getRuntimeStatus());
            }
        },
        {
            key: "getRuntimeStatus",
            value: function getRuntimeStatus() {
                return {
                    paused: this.paused,
                    speedTps: this.speedTps
                };
            }
        },
        {
            key: "emitStatus",
            value: function emitStatus() {
                var status = this.getRuntimeStatus();
                this.emit("status", status);
                return status;
            }
        },
        {
            key: "syncTimer",
            value: function syncTimer() {
                var _this = this;
                this.clearTimer();
                if (!this.started || this.paused || this.speedTps <= 0) {
                    return;
                }
                this.timerHandle = this.scheduler.setInterval(function() {
                    _this.dispatch({
                        type: "Tick"
                    });
                }, 1000 / this.speedTps);
            }
        },
        {
            key: "clearTimer",
            value: function clearTimer() {
                if (this.timerHandle === undefined) {
                    return;
                }
                this.scheduler.clearInterval(this.timerHandle);
                this.timerHandle = undefined;
            }
        }
    ], [
        {
            key: "getVersion",
            value: function getVersion() {
                return VERSION;
            }
        }
    ]);
    return GameRuntime;
}(EventEmitter);
