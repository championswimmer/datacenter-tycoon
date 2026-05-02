//# hash=77e51ebd5d6ecb51e262d8a848ce8838
//# sourceMappingURL=contracts.test.js.map

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
function ownKeys(object, enumerableOnly) {
    var keys = Object.keys(object);
    if (Object.getOwnPropertySymbols) {
        var symbols = Object.getOwnPropertySymbols(object);
        if (enumerableOnly) {
            symbols = symbols.filter(function(sym) {
                return Object.getOwnPropertyDescriptor(object, sym).enumerable;
            });
        }
        keys.push.apply(keys, symbols);
    }
    return keys;
}
function _object_spread_props(target, source) {
    source = source != null ? source : {};
    if (Object.getOwnPropertyDescriptors) {
        Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
        ownKeys(Object(source)).forEach(function(key) {
            Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
        });
    }
    return target;
}
import assert from "node:assert/strict";
import test from "node:test";
import { newGame } from "@datacenter-tycoon/game-logic";
import { renderContractsTab } from "./contracts.js";
test("renderContractsTab shows market and active contracts", function() {
    var snapshot = _object_spread_props(_object_spread({}, newGame(1)), {
        contractMarket: [
            {
                id: "offer-1",
                name: "Offer 1",
                requirements: {
                    vCpu: 1,
                    ramGb: 1,
                    storageTb: 1,
                    gpuFlops: 0
                },
                monthlyPayment: 500,
                penaltyPerMonth: 100,
                termMonths: 3,
                status: "offered",
                urgency: "standard",
                tier: 1,
                offeredAtTick: 0,
                expiresAtTick: 10
            }
        ],
        activeContracts: [
            {
                id: "active-1",
                name: "Active 1",
                requirements: {
                    vCpu: 1,
                    ramGb: 1,
                    storageTb: 1,
                    gpuFlops: 0
                },
                monthlyPayment: 700,
                penaltyPerMonth: 100,
                termMonths: 6,
                status: "active",
                urgency: "standard",
                tier: 1,
                offeredAtTick: 0,
                expiresAtTick: 10,
                assignedDcId: "dc-1",
                startedAtTick: 1
            }
        ]
    });
    var rendered = renderContractsTab(snapshot).join("\n");
    assert.match(rendered, /Market:/);
    assert.match(rendered, /offer-1/);
    assert.match(rendered, /Active:/);
    assert.match(rendered, /active-1/);
    assert.match(rendered, /dc=dc-1/);
});
