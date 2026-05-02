//# hash=8e2001fce08151ac2c3ad2f62ccb0a9f
//# sourceMappingURL=ls.js.map

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
    try {
        var info = gen[key](arg);
        var value = info.value;
    } catch (error) {
        reject(error);
        return;
    }
    if (info.done) {
        resolve(value);
    } else {
        Promise.resolve(value).then(_next, _throw);
    }
}
function _async_to_generator(fn) {
    return function() {
        var self = this, args = arguments;
        return new Promise(function(resolve, reject) {
            var gen = fn.apply(self, args);
            function _next(value) {
                asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
            }
            function _throw(err) {
                asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
            }
            _next(undefined);
        });
    };
}
function _ts_generator(thisArg, body) {
    var f, y, t, _ = {
        label: 0,
        sent: function() {
            if (t[0] & 1) throw t[1];
            return t[1];
        },
        trys: [],
        ops: []
    }, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype), d = Object.defineProperty;
    return d(g, "next", {
        value: verb(0)
    }), d(g, "throw", {
        value: verb(1)
    }), d(g, "return", {
        value: verb(2)
    }), typeof Symbol === "function" && d(g, Symbol.iterator, {
        value: function() {
            return this;
        }
    }), g;
    function verb(n) {
        return function(v) {
            return step([
                n,
                v
            ]);
        };
    }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while(g && (g = 0, op[0] && (_ = 0)), _)try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [
                op[0] & 2,
                t.value
            ];
            switch(op[0]){
                case 0:
                case 1:
                    t = op;
                    break;
                case 4:
                    _.label++;
                    return {
                        value: op[1],
                        done: false
                    };
                case 5:
                    _.label++;
                    y = op[1];
                    op = [
                        0
                    ];
                    continue;
                case 7:
                    op = _.ops.pop();
                    _.trys.pop();
                    continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                        _ = 0;
                        continue;
                    }
                    if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                        _.label = op[1];
                        break;
                    }
                    if (op[0] === 6 && _.label < t[1]) {
                        _.label = t[1];
                        t = op;
                        break;
                    }
                    if (t && _.label < t[2]) {
                        _.label = t[2];
                        _.ops.push(op);
                        break;
                    }
                    if (t[2]) _.ops.pop();
                    _.trys.pop();
                    continue;
            }
            op = body.call(thisArg, _);
        } catch (e) {
            op = [
                6,
                e
            ];
            y = 0;
        } finally{
            f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return {
            value: op[0] ? op[1] : void 0,
            done: true
        };
    }
}
import fs from "node:fs";
import path from "node:path";
import { deserialize } from "@datacenter-tycoon/game-logic";
import { resolveCommandPaths, writeCommandResult } from "./common.js";
export function runLsCommand(parsed) {
    return _async_to_generator(function() {
        var subCommand;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    subCommand = parsed.positionals[0];
                    if (!(subCommand === "saves")) return [
                        3,
                        2
                    ];
                    return [
                        4,
                        listSaves(parsed)
                    ];
                case 1:
                    _state.sent();
                    return [
                        3,
                        3
                    ];
                case 2:
                    throw new Error("Usage: dct ls saves");
                case 3:
                    return [
                        2
                    ];
            }
        });
    })();
}
function listSaves(parsed) {
    return _async_to_generator(function() {
        var paths, dataDir, files, saves, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, file, content, state, table;
        return _ts_generator(this, function(_state) {
            paths = resolveCommandPaths(parsed);
            dataDir = paths.dataDir;
            if (!fs.existsSync(dataDir)) {
                writeCommandResult(parsed, "No saves found (data directory does not exist).", {
                    saves: []
                });
                return [
                    2
                ];
            }
            files = fs.readdirSync(dataDir).filter(function(f) {
                return f.endsWith(".json");
            });
            saves = [];
            _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
            try {
                for(_iterator = files[Symbol.iterator](); !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                    file = _step.value;
                    try {
                        content = fs.readFileSync(path.join(dataDir, file), "utf8");
                        state = deserialize(content);
                        saves.push({
                            file: file,
                            gameId: state.gameId,
                            tick: state.tick,
                            cash: state.player.cash,
                            playerName: state.player.name
                        });
                    } catch (e) {
                    // Skip invalid saves
                    }
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
            table = saves.map(function(s) {
                return "".concat(s.file.padEnd(40), " | Tick: ").concat(String(s.tick).padStart(6), " | Cash: $").concat(String(s.cash).padStart(10), " | ").concat(s.playerName);
            }).join("\n");
            writeCommandResult(parsed, saves.length > 0 ? "Available Saves:\n".concat(table) : "No valid saves found.", {
                saves: saves
            });
            return [
                2
            ];
        });
    })();
}
