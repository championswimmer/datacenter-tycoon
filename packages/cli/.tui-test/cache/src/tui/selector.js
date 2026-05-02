//# hash=d2287b03e714486c8d68002a5d7a1fc6
//# sourceMappingURL=selector.js.map

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
import readline from "node:readline";
import fs from "node:fs";
import path from "node:path";
import { deserialize } from "@datacenter-tycoon/game-logic";
import { resolvePaths } from "../paths.js";
export function selectSaveTui() {
    return _async_to_generator(function() {
        var paths, dataDir, files, saves, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, file, content, state, stdin, stdout, wasRaw, cursor, render;
        return _ts_generator(this, function(_state) {
            paths = resolvePaths();
            dataDir = paths.dataDir;
            if (!fs.existsSync(dataDir)) {
                return [
                    2,
                    undefined
                ];
            }
            files = fs.readdirSync(dataDir).filter(function(f) {
                return f.endsWith(".json");
            });
            if (files.length === 0) {
                return [
                    2,
                    undefined
                ];
            }
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
            if (saves.length === 0) {
                return [
                    2,
                    undefined
                ];
            }
            // Sort by most recent (not perfect as it's just based on file name or creation date, 
            // but let's assume if they have multiple they want a list)
            stdin = process.stdin;
            stdout = process.stdout;
            wasRaw = stdin.isRaw;
            cursor = 0;
            render = function render() {
                stdout.write("\u001B[2J\u001B[H");
                stdout.write("Datacenter Tycoon - Select a save to load\n");
                stdout.write("========================================\n\n");
                saves.forEach(function(s, i) {
                    var prefix = i === cursor ? "> " : "  ";
                    stdout.write("".concat(prefix).concat(s.file.padEnd(20), " | Tick: ").concat(String(s.tick).padStart(6), " | Cash: $").concat(String(s.cash).padStart(8), " | ").concat(s.playerName, "\n"));
                });
                stdout.write("\nUse up/down to select, Enter to load, 'n' for new game, 'q' to quit\n");
            };
            stdin.setRawMode(true);
            stdin.resume();
            readline.emitKeypressEvents(stdin);
            render();
            return [
                2,
                new Promise(function(resolve) {
                    var onKeypress = function onKeypress(value, key) {
                        if (key.name === "up") {
                            cursor = Math.max(0, cursor - 1);
                            render();
                        } else if (key.name === "down") {
                            cursor = Math.min(saves.length - 1, cursor + 1);
                            render();
                        } else if (key.name === "return") {
                            cleanup();
                            var selected = saves[cursor];
                            resolve(selected === null || selected === void 0 ? void 0 : selected.gameId);
                        } else if (key.name === "n") {
                            cleanup();
                            resolve(undefined);
                        } else if (key.name === "q" || key.ctrl && key.name === "c") {
                            cleanup();
                            process.exit(0);
                        }
                    };
                    var cleanup = function cleanup() {
                        stdin.off("keypress", onKeypress);
                        stdin.setRawMode(wasRaw);
                        stdout.write("\u001B[2J\u001B[H");
                    };
                    stdin.on("keypress", onKeypress);
                })
            ];
        });
    })();
}
