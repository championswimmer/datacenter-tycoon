//# hash=a6c89594e05428526a0a84062b388aa3
//# sourceMappingURL=argv.js.map

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
var GLOBAL_FLAGS = [
    "--json",
    "--socket",
    "--save",
    "--no-daemon",
    "--quiet",
    "-h",
    "--help"
];
export function parseArgv(args) {
    var flags = {};
    var positionals = [];
    var command;
    for(var index = 0; index < args.length; index += 1){
        var arg = args[index];
        if (!arg) {
            continue;
        }
        if (arg.startsWith("--")) {
            var equalsIndex = arg.indexOf("=");
            if (equalsIndex >= 0) {
                flags[arg.slice(0, equalsIndex)] = arg.slice(equalsIndex + 1);
                continue;
            }
            var nextArg = args[index + 1];
            if (nextArg && !nextArg.startsWith("-")) {
                flags[arg] = nextArg;
                index += 1;
                continue;
            }
            flags[arg] = true;
            continue;
        }
        if (arg.startsWith("-") && arg.length > 1) {
            flags[arg] = true;
            continue;
        }
        if (!command) {
            command = arg;
            continue;
        }
        positionals.push(arg);
    }
    return {
        command: command,
        positionals: positionals,
        flags: flags,
        rawArgs: args
    };
}
export function hasHelpFlag(parsed) {
    return parsed.flags["-h"] === true || parsed.flags["--help"] === true;
}
export function getFlagValue(parsed, flag) {
    return parsed.flags[flag];
}
export function formatHelp(commands) {
    var lines = [
        "Datacenter Tycoon CLI",
        "",
        "Usage:",
        "  dct [command] [options]",
        "",
        "Commands:"
    ].concat(_to_consumable_array(commands.map(function(command) {
        return "  ".concat(command.name.padEnd(18), " ").concat(command.summary);
    })), [
        "",
        "Global flags:"
    ], _to_consumable_array(GLOBAL_FLAGS.map(function(flag) {
        return "  ".concat(flag);
    })));
    return lines.join("\n");
}
