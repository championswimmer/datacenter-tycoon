//# hash=0fbfd446c6f75edb3bf29a73daa912a3
//# sourceMappingURL=catalog.js.map

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
import { DATACENTER_CATALOG, RACK_CATALOG } from "@datacenter-tycoon/game-logic";
export function renderCatalogTab() {
    return [
        "Catalog",
        "",
        "Datacenters:"
    ].concat(_to_consumable_array(Object.values(DATACENTER_CATALOG).map(function(spec) {
        return "  ".concat(spec.id, "  ").concat(spec.name, "  rows=").concat(spec.rows, "  positions=").concat(spec.positionsPerRow, "  capex=$").concat(spec.capexCost);
    })), [
        "",
        "Racks:"
    ], _to_consumable_array(Object.values(RACK_CATALOG).map(function(spec) {
        return "  ".concat(spec.id, "  ").concat(spec.name, "  kind=").concat(spec.kind, "  tier=").concat(spec.tier, "  vcpu=").concat(spec.vCpu, "  ram=").concat(spec.ramGb, "  capex=$").concat(spec.capexCost);
    })));
}
