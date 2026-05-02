//# hash=513a954c632d4f11f84a3adf5a1d5577
//# sourceMappingURL=dashboard.test.js.map

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
import { renderDashboardTab } from "./dashboard.js";
test("renderDashboardTab shows KPIs and ledger tail", function() {
    var snapshot = _object_spread_props(_object_spread({}, newGame(1)), {
        player: {
            id: "player-1",
            name: "Player",
            cash: 42000
        },
        ledger: [
            {
                id: "l-1",
                tick: 2,
                type: "revenue",
                amount: 5000,
                reason: "Contract payout"
            }
        ]
    });
    var lines = renderDashboardTab(snapshot);
    assert.match(lines.join("\n"), /Cash: \$42,000/);
    assert.match(lines.join("\n"), /Ledger tail/);
    assert.match(lines.join("\n"), /Contract payout/);
});
