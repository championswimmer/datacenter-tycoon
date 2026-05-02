//# hash=3691a83e732796d193f177d119e99dfa
//# sourceMappingURL=dashboard.js.map

function _array_like_to_array(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes(arr) {
    if (Array.isArray(arr)) return _array_like_to_array(arr);
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
export function renderDashboardTab(snapshot) {
    var ledgerTail = snapshot.ledger.slice(-10).map(function(entry) {
        return "  ".concat(entry.tick.toString().padStart(4), "  ").concat(entry.type.padEnd(10), "  ").concat(entry.amount.toString().padStart(8), "  ").concat(entry.reason);
    });
    var headline = [
        "Cash: $".concat(new Intl.NumberFormat("en-US", {
            maximumFractionDigits: 0
        }).format(snapshot.player.cash)),
        "Datacenters: ".concat(snapshot.datacenters.length),
        "Active contracts: ".concat(snapshot.activeContracts.length),
        "Market contracts: ".concat(snapshot.contractMarket.length)
    ];
    var alerts = [];
    if (snapshot.player.cash < 0) {
        alerts.push("Alert: cash is negative.");
    }
    if (snapshot.activeContracts.some(function(contract) {
        return contract.status === "breached";
    })) {
        alerts.push("Alert: one or more contracts are breached.");
    }
    if (alerts.length === 0) {
        alerts.push("Alerts: none");
    }
    return [
        "Dashboard",
        ""
    ].concat(_to_consumable_array(headline), [
        ""
    ], _to_consumable_array(alerts), [
        "",
        "Ledger tail:"
    ], _to_consumable_array(ledgerTail.length > 0 ? ledgerTail : [
        "  No ledger entries yet."
    ]));
}
