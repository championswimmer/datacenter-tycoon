//# hash=9efe1e1ad2ff4cd377c03f50ee3fd57d
//# sourceMappingURL=app.js.map

function _array_like_to_array(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_without_holes(arr) {
    if (Array.isArray(arr)) return _array_like_to_array(arr);
}
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
function _instanceof(left, right) {
    "@swc/helpers - instanceof";
    if (right != null && typeof Symbol !== "undefined" && right[Symbol.hasInstance]) {
        return !!right[Symbol.hasInstance](left);
    } else {
        return left instanceof right;
    }
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
import { DctClient } from "../client/client.js";
import { resolvePaths } from "../paths.js";
import { renderLayout } from "./layout.js";
import { autocompletePaletteInput, splitCommandLine } from "./palette.js";
import { selectSaveTui } from "./selector.js";
import { renderCatalogTab } from "./tabs/catalog.js";
import { renderContractsTab } from "./tabs/contracts.js";
import { renderDashboardTab } from "./tabs/dashboard.js";
import { renderDatacentersTab } from "./tabs/datacenters.js";
function getBodyLines(snapshot, activeTab, selectedDatacenterIndex) {
    if (!snapshot) {
        return [
            "Loading terminal UI...",
            "",
            "Press q to quit."
        ];
    }
    if (activeTab === "dashboard") {
        return renderDashboardTab(snapshot);
    }
    if (activeTab === "datacenters") {
        return renderDatacentersTab(snapshot, selectedDatacenterIndex);
    }
    if (activeTab === "contracts") {
        return renderContractsTab(snapshot);
    }
    return renderCatalogTab();
}
function renderFrame(snapshot, status, activeTab, selectedDatacenterIndex, statusLine) {
    var showHelp = arguments.length > 5 && arguments[5] !== void 0 ? arguments[5] : false, reconnecting = arguments.length > 6 && arguments[6] !== void 0 ? arguments[6] : false;
    var _ref, _ref1, _ref2, _ref3, _ref4, _ref5;
    return renderLayout({
        tick: (_ref = (_ref1 = status === null || status === void 0 ? void 0 : status.tick) !== null && _ref1 !== void 0 ? _ref1 : snapshot === null || snapshot === void 0 ? void 0 : snapshot.tick) !== null && _ref !== void 0 ? _ref : 0,
        cash: (_ref2 = (_ref3 = status === null || status === void 0 ? void 0 : status.cash) !== null && _ref3 !== void 0 ? _ref3 : snapshot === null || snapshot === void 0 ? void 0 : snapshot.player.cash) !== null && _ref2 !== void 0 ? _ref2 : 0,
        speedTps: (_ref4 = status === null || status === void 0 ? void 0 : status.speedTps) !== null && _ref4 !== void 0 ? _ref4 : 0,
        paused: (_ref5 = status === null || status === void 0 ? void 0 : status.paused) !== null && _ref5 !== void 0 ? _ref5 : true,
        activeTab: activeTab,
        bodyLines: getBodyLines(snapshot, activeTab, selectedDatacenterIndex),
        statusLine: statusLine,
        showHelp: showHelp,
        reconnecting: reconnecting
    });
}
function executePaletteCommand(input) {
    return _async_to_generator(function() {
        var args, runCli, output, originalLog, _output_at, error;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    args = splitCommandLine(input);
                    if (args.length === 0) {
                        return [
                            2,
                            "Command palette cancelled"
                        ];
                    }
                    return [
                        4,
                        import("../cli.js")
                    ];
                case 1:
                    runCli = _state.sent().runCli;
                    output = [];
                    originalLog = console.log;
                    console.log = function(message) {
                        output.push(String(message !== null && message !== void 0 ? message : ""));
                    };
                    _state.label = 2;
                case 2:
                    _state.trys.push([
                        2,
                        4,
                        5,
                        6
                    ]);
                    return [
                        4,
                        runCli(args)
                    ];
                case 3:
                    _state.sent();
                    return [
                        2,
                        (_output_at = output.at(-1)) !== null && _output_at !== void 0 ? _output_at : "Ran: ".concat(input)
                    ];
                case 4:
                    error = _state.sent();
                    return [
                        2,
                        _instanceof(error, Error) ? error.message : String(error)
                    ];
                case 5:
                    console.log = originalLog;
                    return [
                        7
                    ];
                case 6:
                    return [
                        2
                    ];
            }
        });
    })();
}
export function runTui() {
    return _async_to_generator(function() {
        var selectedGameId, stdin, stdout, wasRaw, activeTab, selectedDatacenterIndex, showHelp, reconnecting, paletteOpen, paletteInput, paletteHistory, paletteHistoryIndex, statusLine, paths, client, snapshot, status, unused, render, subscribe, subscription, reconnectTimer;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    return [
                        4,
                        selectSaveTui()
                    ];
                case 1:
                    selectedGameId = _state.sent();
                    stdin = process.stdin;
                    stdout = process.stdout;
                    wasRaw = stdin.isRaw;
                    activeTab = "dashboard";
                    selectedDatacenterIndex = 0;
                    showHelp = false;
                    reconnecting = false;
                    paletteOpen = false;
                    paletteInput = "";
                    paletteHistory = [];
                    paletteHistoryIndex = -1;
                    statusLine = "q quit · 1 dashboard · 2 dcs · 3 contracts · 4 catalog · : commands";
                    if (!stdin.isTTY || !stdout.isTTY) {
                        stdout.write(renderFrame(undefined, undefined, activeTab, selectedDatacenterIndex, statusLine));
                        return [
                            2
                        ];
                    }
                    paths = resolvePaths({
                        gameId: selectedGameId
                    });
                    client = new DctClient({
                        socketPath: paths.socketPath,
                        savePath: paths.savePath
                    });
                    _state.label = 2;
                case 2:
                    _state.trys.push([
                        2,
                        6,
                        ,
                        7
                    ]);
                    return [
                        4,
                        client.connect()
                    ];
                case 3:
                    _state.sent();
                    return [
                        4,
                        client.query({
                            kind: "status"
                        })
                    ];
                case 4:
                    status = _state.sent();
                    return [
                        4,
                        client.query({
                            kind: "snapshot"
                        })
                    ];
                case 5:
                    snapshot = _state.sent();
                    return [
                        3,
                        7
                    ];
                case 6:
                    unused = _state.sent();
                    reconnecting = true;
                    return [
                        3,
                        7
                    ];
                case 7:
                    render = function render() {
                        var effectiveStatusLine = paletteOpen ? ":".concat(paletteInput) : statusLine;
                        stdout.write("\x1b[2J\x1b[H\x1b[?1049h\n".concat(renderFrame(snapshot, status, activeTab, selectedDatacenterIndex, effectiveStatusLine, showHelp, reconnecting)));
                    };
                    subscribe = function subscribe() {
                        return _async_to_generator(function() {
                            return _ts_generator(this, function(_state) {
                                switch(_state.label){
                                    case 0:
                                        if (!snapshot) {
                                            return [
                                                2,
                                                undefined
                                            ];
                                        }
                                        return [
                                            4,
                                            client.subscribeState(function(nextSnapshot) {
                                                snapshot = nextSnapshot;
                                            }, function() {
                                                render();
                                            })
                                        ];
                                    case 1:
                                        return [
                                            2,
                                            _state.sent()
                                        ];
                                }
                            });
                        })();
                    };
                    return [
                        4,
                        subscribe()
                    ];
                case 8:
                    subscription = _state.sent();
                    reconnectTimer = setInterval(function() {
                        return _async_to_generator(function() {
                            var unused, unused1;
                            return _ts_generator(this, function(_state) {
                                switch(_state.label){
                                    case 0:
                                        _state.trys.push([
                                            0,
                                            5,
                                            ,
                                            13
                                        ]);
                                        return [
                                            4,
                                            client.query({
                                                kind: "status"
                                            })
                                        ];
                                    case 1:
                                        status = _state.sent();
                                        reconnecting = false;
                                        if (!!snapshot) return [
                                            3,
                                            4
                                        ];
                                        return [
                                            4,
                                            client.query({
                                                kind: "snapshot"
                                            })
                                        ];
                                    case 2:
                                        snapshot = _state.sent();
                                        return [
                                            4,
                                            subscribe()
                                        ];
                                    case 3:
                                        subscription = _state.sent();
                                        _state.label = 4;
                                    case 4:
                                        return [
                                            3,
                                            13
                                        ];
                                    case 5:
                                        unused = _state.sent();
                                        _state.label = 6;
                                    case 6:
                                        _state.trys.push([
                                            6,
                                            11,
                                            ,
                                            12
                                        ]);
                                        return [
                                            4,
                                            client.reconnect()
                                        ];
                                    case 7:
                                        _state.sent();
                                        return [
                                            4,
                                            client.query({
                                                kind: "status"
                                            })
                                        ];
                                    case 8:
                                        status = _state.sent();
                                        return [
                                            4,
                                            client.query({
                                                kind: "snapshot"
                                            })
                                        ];
                                    case 9:
                                        snapshot = _state.sent();
                                        reconnecting = false;
                                        return [
                                            4,
                                            subscribe()
                                        ];
                                    case 10:
                                        subscription = _state.sent();
                                        return [
                                            3,
                                            12
                                        ];
                                    case 11:
                                        unused1 = _state.sent();
                                        reconnecting = true;
                                        return [
                                            3,
                                            12
                                        ];
                                    case 12:
                                        return [
                                            3,
                                            13
                                        ];
                                    case 13:
                                        if (reconnecting) {
                                            statusLine = "Reconnecting to daemon...";
                                        }
                                        render();
                                        return [
                                            2
                                        ];
                                }
                            });
                        })();
                    }, 1000);
                    readline.emitKeypressEvents(stdin);
                    stdin.setRawMode(true);
                    stdin.resume();
                    render();
                    return [
                        4,
                        new Promise(function(resolve) {
                            var cleanup = function cleanup() {
                                stdin.off("keypress", onKeypress);
                                stdin.off("data", onData);
                            };
                            var onKeypress = function onKeypress(value, key) {
                                return _async_to_generator(function() {
                                    var command, _paletteHistory_paletteHistoryIndex, _paletteHistory_paletteHistoryIndex1, _ref, _ref1, _snapshot_datacenters_selectedDatacenterIndex, selectedDc, _ref2, _snapshot_datacenters_selectedDatacenterIndex1, selectedDc1;
                                    return _ts_generator(this, function(_state) {
                                        switch(_state.label){
                                            case 0:
                                                if (!paletteOpen) return [
                                                    3,
                                                    3
                                                ];
                                                if (key.name === "escape") {
                                                    paletteOpen = false;
                                                    paletteInput = "";
                                                    statusLine = "Command palette cancelled";
                                                    render();
                                                    return [
                                                        2
                                                    ];
                                                }
                                                if (!(key.name === "return")) return [
                                                    3,
                                                    2
                                                ];
                                                paletteOpen = false;
                                                command = paletteInput.trim();
                                                if (command) {
                                                    paletteHistory = _to_consumable_array(paletteHistory).concat([
                                                        command
                                                    ]);
                                                    paletteHistoryIndex = paletteHistory.length;
                                                }
                                                return [
                                                    4,
                                                    executePaletteCommand(command)
                                                ];
                                            case 1:
                                                statusLine = _state.sent();
                                                paletteInput = "";
                                                render();
                                                return [
                                                    2
                                                ];
                                            case 2:
                                                if (key.name === "backspace") {
                                                    paletteInput = paletteInput.slice(0, -1);
                                                    render();
                                                    return [
                                                        2
                                                    ];
                                                }
                                                if (key.name === "tab") {
                                                    paletteInput = autocompletePaletteInput(paletteInput);
                                                    render();
                                                    return [
                                                        2
                                                    ];
                                                }
                                                if (key.name === "up") {
                                                    ;
                                                    paletteHistoryIndex = Math.max(0, paletteHistoryIndex - 1);
                                                    paletteInput = (_paletteHistory_paletteHistoryIndex = paletteHistory[paletteHistoryIndex]) !== null && _paletteHistory_paletteHistoryIndex !== void 0 ? _paletteHistory_paletteHistoryIndex : paletteInput;
                                                    render();
                                                    return [
                                                        2
                                                    ];
                                                }
                                                if (key.name === "down") {
                                                    ;
                                                    paletteHistoryIndex = Math.min(paletteHistory.length, paletteHistoryIndex + 1);
                                                    paletteInput = (_paletteHistory_paletteHistoryIndex1 = paletteHistory[paletteHistoryIndex]) !== null && _paletteHistory_paletteHistoryIndex1 !== void 0 ? _paletteHistory_paletteHistoryIndex1 : "";
                                                    render();
                                                    return [
                                                        2
                                                    ];
                                                }
                                                if (value) {
                                                    paletteInput += value;
                                                    render();
                                                }
                                                return [
                                                    2
                                                ];
                                            case 3:
                                                if (key.name === "q" || key.ctrl && key.name === "c") {
                                                    cleanup();
                                                    resolve();
                                                    return [
                                                        2
                                                    ];
                                                }
                                                if (key.name === "1") activeTab = "dashboard";
                                                if (key.name === "2") activeTab = "datacenters";
                                                if (key.name === "3") activeTab = "contracts";
                                                if (key.name === "4") activeTab = "catalog";
                                                if (key.name === "?") showHelp = !showHelp;
                                                if (key.name === ":") {
                                                    paletteOpen = true;
                                                    paletteInput = "";
                                                    paletteHistoryIndex = paletteHistory.length;
                                                    render();
                                                    return [
                                                        2
                                                    ];
                                                }
                                                if (activeTab === "datacenters" && key.name === "up") {
                                                    selectedDatacenterIndex = Math.max(0, selectedDatacenterIndex - 1);
                                                }
                                                if (activeTab === "datacenters" && key.name === "down") {
                                                    ;
                                                    selectedDatacenterIndex = Math.min(((_ref = snapshot === null || snapshot === void 0 ? void 0 : snapshot.datacenters.length) !== null && _ref !== void 0 ? _ref : 1) - 1, selectedDatacenterIndex + 1);
                                                }
                                                if (activeTab === "datacenters" && key.name === "n") {
                                                    paletteOpen = true;
                                                    paletteInput = "build-dc ";
                                                }
                                                if (activeTab === "datacenters" && key.name === "r") {
                                                    ;
                                                    ;
                                                    selectedDc = (_ref1 = snapshot === null || snapshot === void 0 ? void 0 : (_snapshot_datacenters_selectedDatacenterIndex = snapshot.datacenters[selectedDatacenterIndex]) === null || _snapshot_datacenters_selectedDatacenterIndex === void 0 ? void 0 : _snapshot_datacenters_selectedDatacenterIndex.id) !== null && _ref1 !== void 0 ? _ref1 : "";
                                                    paletteOpen = true;
                                                    paletteInput = selectedDc ? "add-rack ".concat(selectedDc, " ") : "add-rack ";
                                                }
                                                if (activeTab === "datacenters" && key.name === "x") {
                                                    ;
                                                    ;
                                                    selectedDc1 = (_ref2 = snapshot === null || snapshot === void 0 ? void 0 : (_snapshot_datacenters_selectedDatacenterIndex1 = snapshot.datacenters[selectedDatacenterIndex]) === null || _snapshot_datacenters_selectedDatacenterIndex1 === void 0 ? void 0 : _snapshot_datacenters_selectedDatacenterIndex1.id) !== null && _ref2 !== void 0 ? _ref2 : "";
                                                    paletteOpen = true;
                                                    paletteInput = selectedDc1 ? "remove-rack ".concat(selectedDc1, " ") : "remove-rack ";
                                                }
                                                if (activeTab === "contracts" && key.name === "a") {
                                                    paletteOpen = true;
                                                    paletteInput = "accept-contract ";
                                                }
                                                if (activeTab === "contracts" && key.name === "c") {
                                                    paletteOpen = true;
                                                    paletteInput = "cancel-contract ";
                                                }
                                                render();
                                                return [
                                                    2
                                                ];
                                        }
                                    });
                                })();
                            };
                            var onData = function onData(chunk) {
                                var value = chunk.toString();
                                if (!paletteOpen && (value.includes("q") || value.includes("\u0003"))) {
                                    cleanup();
                                    resolve();
                                }
                            };
                            stdin.on("keypress", onKeypress);
                            stdin.on("data", onData);
                        })
                    ];
                case 9:
                    _state.sent();
                    clearInterval(reconnectTimer);
                    return [
                        4,
                        subscription === null || subscription === void 0 ? void 0 : subscription.unsubscribe().catch(function() {
                            return undefined;
                        })
                    ];
                case 10:
                    _state.sent();
                    return [
                        4,
                        client.close().catch(function() {
                            return undefined;
                        })
                    ];
                case 11:
                    _state.sent();
                    stdout.write("\u001B[?1049l\u001B[2J\u001B[H");
                    stdin.setRawMode(Boolean(wasRaw));
                    stdin.pause();
                    return [
                        2
                    ];
            }
        });
    })();
}
