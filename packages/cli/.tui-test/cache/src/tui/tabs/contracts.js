//# hash=2c4e77ddbddb62dcb435074f463433e4
//# sourceMappingURL=contracts.js.map

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
export function renderContractsTab(snapshot) {
    var lines = [
        "Contracts",
        "",
        "Market:"
    ];
    if (snapshot.contractMarket.length === 0) {
        lines.push("  No market contracts available.");
    } else {
        var _lines;
        (_lines = lines).push.apply(_lines, _to_consumable_array(snapshot.contractMarket.map(function(contract) {
            return "  ".concat(contract.id, "  ").concat(contract.name, "  $").concat(contract.monthlyPayment, "/mo  ").concat(contract.termMonths, "m  ").concat(contract.status);
        })));
    }
    lines.push("", "Active:");
    if (snapshot.activeContracts.length === 0) {
        lines.push("  No active contracts.");
    } else {
        var _lines1;
        (_lines1 = lines).push.apply(_lines1, _to_consumable_array(snapshot.activeContracts.map(function(contract) {
            var _contract_assignedDcId;
            return "  ".concat(contract.id, "  ").concat(contract.name, "  dc=").concat((_contract_assignedDcId = contract.assignedDcId) !== null && _contract_assignedDcId !== void 0 ? _contract_assignedDcId : "-", "  $").concat(contract.monthlyPayment, "/mo  ").concat(contract.status);
        })));
    }
    lines.push("", "Use :accept-contract <contractId> <dcId> or :cancel-contract <contractId>.");
    return lines;
}
