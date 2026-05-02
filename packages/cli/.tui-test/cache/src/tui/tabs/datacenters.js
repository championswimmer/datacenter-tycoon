//# hash=eba6fa75e5e7bb5491f0823bef353c66
//# sourceMappingURL=datacenters.js.map

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
export function renderDatacentersTab(snapshot, selectedIndex) {
    if (snapshot.datacenters.length === 0) {
        return [
            "Datacenters",
            "",
            "No datacenters yet.",
            "Use :build-dc <specId> or press n later to create one."
        ];
    }
    var selected = snapshot.datacenters[Math.max(0, Math.min(selectedIndex, snapshot.datacenters.length - 1))];
    if (!selected) {
        return [
            "Datacenters",
            "",
            "No datacenters yet."
        ];
    }
    var placementsByCell = new Map(selected.placements.map(function(placement) {
        return [
            "".concat(placement.row, ":").concat(placement.position),
            placement.specId
        ];
    }));
    var rows = [];
    for(var row = 0; row < selected.spec.rows; row += 1){
        var cells = [];
        for(var position = 0; position < selected.spec.positionsPerRow; position += 1){
            var specId = placementsByCell.get("".concat(row, ":").concat(position));
            cells.push(specId ? "[".concat(specId.padEnd(2), "]") : "[  ]");
        }
        rows.push("r".concat(row, ": ").concat(cells.join(" ")));
    }
    return [
        "Datacenters (".concat(snapshot.datacenters.length, ")"),
        ""
    ].concat(_to_consumable_array(snapshot.datacenters.map(function(datacenter, index) {
        return "".concat(index === selectedIndex ? ">" : " ", " ").concat(datacenter.id, "  ").concat(datacenter.name, "  racks ").concat(datacenter.placements.length);
    })), [
        "",
        "Selected: ".concat(selected.id, " \xb7 ").concat(selected.name),
        "Power ".concat(selected.spec.powerCapacityKw, "kW \xb7 Cooling ").concat(selected.spec.coolingCapacityBtuPerHr, " BTU/h \xb7 Bandwidth ").concat(selected.spec.bandwidthGbps, " Gbps"),
        "Rack grid:"
    ], _to_consumable_array(rows));
}
