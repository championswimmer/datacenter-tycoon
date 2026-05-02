//# hash=fa73b836074b6367704f03d630ccdabf
//# sourceMappingURL=layout.js.map

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
var TAB_LABELS = [
    {
        id: "dashboard",
        label: "1 Dashboard"
    },
    {
        id: "datacenters",
        label: "2 DCs"
    },
    {
        id: "contracts",
        label: "3 Contracts"
    },
    {
        id: "catalog",
        label: "4 Catalog"
    }
];
function formatMoney(amount) {
    return new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 0
    }).format(amount);
}
function pad(line) {
    var width = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 78;
    return line.length >= width ? line.slice(0, width) : line.padEnd(width);
}
export function renderLayout(model) {
    var statusBadge = model.paused ? "PAUSED" : "speed ".concat(model.speedTps, "x");
    var header = pad("Datacenter Tycoon  tick ".concat(model.tick, "  cash $").concat(formatMoney(model.cash), "  ").concat(statusBadge));
    var tabs = TAB_LABELS.map(function(tab) {
        return tab.id === model.activeTab ? "[".concat(tab.label, "]") : " ".concat(tab.label, " ");
    }).join("  ");
    var reconnecting = model.reconnecting ? "  reconnecting…" : "";
    var body = model.bodyLines.length > 0 ? model.bodyLines : [
        "Loading terminal UI..."
    ];
    var helpLines = model.showHelp ? [
        "",
        "Keys: 1-4 tabs · : command palette · ? help · q quit",
        "Dashboard: default view",
        "Datacenters: arrow keys to move selection",
        "Contracts: a accept · c cancel"
    ] : [];
    return [
        header,
        pad("".concat(tabs).concat(reconnecting)),
        "-".repeat(78)
    ].concat(_to_consumable_array(body.map(function(line) {
        return pad(line);
    })), _to_consumable_array(helpLines.map(function(line) {
        return pad(line);
    })), [
        "-".repeat(78),
        pad(model.statusLine)
    ]).join("\n");
}
