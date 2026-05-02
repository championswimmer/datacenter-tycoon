//# hash=73b1fb08a310912d437fd772ca1adbee
//# sourceMappingURL=palette.js.map

export var TUI_COMMANDS = [
    "status",
    "new",
    "load",
    "save",
    "quit",
    "ls",
    "build-dc",
    "add-rack",
    "remove-rack",
    "accept-contract",
    "cancel-contract",
    "tick",
    "pause",
    "resume",
    "speed"
];
export function splitCommandLine(input) {
    var tokens = [];
    var current = "";
    var quote;
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = input[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var char = _step.value;
            if (quote) {
                if (char === quote) {
                    quote = undefined;
                } else {
                    current += char;
                }
                continue;
            }
            if (char === '"' || char === "'") {
                quote = char;
                continue;
            }
            if (char === " ") {
                if (current) {
                    tokens.push(current);
                    current = "";
                }
                continue;
            }
            current += char;
        }
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally{
        try {
            if (!_iteratorNormalCompletion && _iterator.return != null) {
                _iterator.return();
            }
        } finally{
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }
    if (current) {
        tokens.push(current);
    }
    return tokens;
}
export function autocompletePaletteInput(input) {
    var trimmed = input.trimStart();
    if (trimmed.includes(" ")) {
        return input;
    }
    var matches = TUI_COMMANDS.filter(function(command) {
        return command.startsWith(trimmed);
    });
    if (matches.length === 1) {
        var prefix = input.slice(0, input.length - trimmed.length);
        return "".concat(prefix).concat(matches[0], " ");
    }
    return input;
}
