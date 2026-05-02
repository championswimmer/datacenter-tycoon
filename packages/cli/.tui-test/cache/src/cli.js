//# hash=b86ebb4179b5d5305e142b0cac405d9f
//# sourceMappingURL=cli.js.map

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
import net from "node:net";
import { formatHelp, getFlagValue, hasHelpFlag, parseArgv } from "./argv.js";
import { runStatusCommand } from "./commands/status.js";
import { runLoadCommand, runNewCommand, runQuitCommand, runSaveCommand } from "./commands/new-load.js";
import { runLsCommand } from "./commands/ls.js";
import { runAddRackCommand, runBuildDatacenterCommand, runRemoveRackCommand } from "./commands/build-dc.js";
import { runAcceptContractCommand, runCancelContractCommand } from "./commands/contracts.js";
import { formatJsonError } from "./commands/common.js";
import { runPauseCommand, runResumeCommand, runSpeedCommand } from "./commands/control.js";
import { runTickCommand } from "./commands/tick.js";
import { GamePersistence, loadOrInit } from "./daemon/persist.js";
import { GameRuntime } from "./daemon/runtime.js";
import { GameDaemonServer } from "./daemon/server.js";
import { DaemonLifecycle, waitForExit } from "./daemon/lifecycle.js";
import { DaemonTransport } from "./daemon/transport.js";
import { resolvePaths } from "./paths.js";
function getStringFlag(parsed, flag) {
    var value = getFlagValue(parsed, flag);
    return typeof value === "string" ? value : undefined;
}
function getNumericFlag(parsed, flag, fallback) {
    var value = getStringFlag(parsed, flag);
    if (!value) {
        return fallback;
    }
    var parsedNumber = Number(value);
    if (!Number.isFinite(parsedNumber)) {
        throw new Error("Invalid value for ".concat(flag, ": ").concat(value));
    }
    return parsedNumber;
}
function runDaemon(parsed) {
    return _async_to_generator(function() {
        var _getStringFlag, paths, persistence, runtime, transport, server, lifecycle;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    paths = resolvePaths({
                        saveOverride: getStringFlag(parsed, "--save"),
                        gameId: (_getStringFlag = getStringFlag(parsed, "--game-id")) !== null && _getStringFlag !== void 0 ? _getStringFlag : getStringFlag(parsed, "--id"),
                        socketOverride: getStringFlag(parsed, "--socket")
                    });
                    persistence = new GamePersistence({
                        savePath: paths.savePath
                    });
                    runtime = new GameRuntime({
                        state: loadOrInit(paths.savePath, getNumericFlag(parsed, "--seed", 1))
                    });
                    transport = new DaemonTransport({
                        socketPath: paths.socketPath
                    });
                    server = new GameDaemonServer({
                        transport: transport,
                        runtime: runtime,
                        persistence: persistence
                    });
                    lifecycle = new DaemonLifecycle({
                        pidPath: paths.pidPath,
                        idleTimeoutMs: getNumericFlag(parsed, "--idle-timeout", 10 * 60 * 1000),
                        transport: transport,
                        runtime: runtime,
                        startServer: function startServer() {
                            return server.start();
                        },
                        stopServer: function stopServer() {
                            return server.close();
                        },
                        exit: function exit(code) {
                            process.exit(code);
                        }
                    });
                    server.on("shutdownRequested", function() {
                        void lifecycle.requestShutdown(0);
                    });
                    return [
                        4,
                        lifecycle.start()
                    ];
                case 1:
                    _state.sent();
                    return [
                        4,
                        waitForExit(lifecycle)
                    ];
                case 2:
                    _state.sent();
                    return [
                        2
                    ];
            }
        });
    })();
}
function runQuit(parsed) {
    return _async_to_generator(function() {
        var socketPath;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    socketPath = resolvePaths({
                        saveOverride: getStringFlag(parsed, "--save"),
                        socketOverride: getStringFlag(parsed, "--socket")
                    }).socketPath;
                    return [
                        4,
                        new Promise(function(resolve, reject) {
                            var socket = net.createConnection(socketPath);
                            var buffer = "";
                            socket.on("connect", function() {
                                socket.write('{"jsonrpc":"2.0","id":1,"method":"control","params":{"op":"shutdown"}}\n');
                            });
                            socket.on("data", function(chunk) {
                                buffer += chunk.toString();
                                var newlineIndex = buffer.indexOf("\n");
                                if (newlineIndex < 0) {
                                    return;
                                }
                                var line = buffer.slice(0, newlineIndex);
                                var response = JSON.parse(line);
                                socket.end();
                                if (response.error) {
                                    reject(new Error(response.error.message));
                                    return;
                                }
                                resolve();
                            });
                            socket.on("error", function(error) {
                                reject(error);
                            });
                        })
                    ];
                case 1:
                    _state.sent();
                    return [
                        2
                    ];
            }
        });
    })();
}
function createNotImplementedHandler(name, summary) {
    return {
        name: name,
        summary: summary,
        run: function run() {
            return _async_to_generator(function() {
                return _ts_generator(this, function(_state) {
                    throw new Error("Command not implemented yet: ".concat(name));
                });
            })();
        }
    };
}
var COMMANDS = [
    {
        name: "daemon",
        summary: "Run the background game daemon",
        run: function run(param) {
            var parsed = param.parsed;
            return _async_to_generator(function() {
                return _ts_generator(this, function(_state) {
                    return [
                        2,
                        runDaemon(parsed)
                    ];
                });
            })();
        }
    },
    {
        name: "status",
        summary: "Print a game summary",
        run: function run(param) {
            var parsed = param.parsed;
            return _async_to_generator(function() {
                return _ts_generator(this, function(_state) {
                    return [
                        2,
                        runStatusCommand(parsed)
                    ];
                });
            })();
        }
    },
    {
        name: "new",
        summary: "Create a new save",
        run: function run(param) {
            var parsed = param.parsed;
            return _async_to_generator(function() {
                return _ts_generator(this, function(_state) {
                    return [
                        2,
                        runNewCommand(parsed)
                    ];
                });
            })();
        }
    },
    {
        name: "load",
        summary: "Load a savefile into the daemon state",
        run: function run(param) {
            var parsed = param.parsed;
            return _async_to_generator(function() {
                return _ts_generator(this, function(_state) {
                    return [
                        2,
                        runLoadCommand(parsed)
                    ];
                });
            })();
        }
    },
    {
        name: "save",
        summary: "Force-save the current game",
        run: function run(param) {
            var parsed = param.parsed;
            return _async_to_generator(function() {
                return _ts_generator(this, function(_state) {
                    return [
                        2,
                        runSaveCommand(parsed)
                    ];
                });
            })();
        }
    },
    {
        name: "quit",
        summary: "Flush state and shut down the daemon",
        run: function run(param) {
            var parsed = param.parsed;
            return _async_to_generator(function() {
                return _ts_generator(this, function(_state) {
                    return [
                        2,
                        runQuitCommand(parsed)
                    ];
                });
            })();
        }
    },
    {
        name: "ls",
        summary: "List datacenters, racks, contracts, or catalog data",
        run: function run(param) {
            var parsed = param.parsed;
            return _async_to_generator(function() {
                return _ts_generator(this, function(_state) {
                    return [
                        2,
                        runLsCommand(parsed)
                    ];
                });
            })();
        }
    },
    {
        name: "build-dc",
        summary: "Build a datacenter",
        run: function run(param) {
            var parsed = param.parsed;
            return _async_to_generator(function() {
                return _ts_generator(this, function(_state) {
                    return [
                        2,
                        runBuildDatacenterCommand(parsed)
                    ];
                });
            })();
        }
    },
    {
        name: "add-rack",
        summary: "Add a rack to a datacenter",
        run: function run(param) {
            var parsed = param.parsed;
            return _async_to_generator(function() {
                return _ts_generator(this, function(_state) {
                    return [
                        2,
                        runAddRackCommand(parsed)
                    ];
                });
            })();
        }
    },
    {
        name: "remove-rack",
        summary: "Remove a rack placement",
        run: function run(param) {
            var parsed = param.parsed;
            return _async_to_generator(function() {
                return _ts_generator(this, function(_state) {
                    return [
                        2,
                        runRemoveRackCommand(parsed)
                    ];
                });
            })();
        }
    },
    {
        name: "accept-contract",
        summary: "Accept a contract",
        run: function run(param) {
            var parsed = param.parsed;
            return _async_to_generator(function() {
                return _ts_generator(this, function(_state) {
                    return [
                        2,
                        runAcceptContractCommand(parsed)
                    ];
                });
            })();
        }
    },
    {
        name: "cancel-contract",
        summary: "Cancel an active contract",
        run: function run(param) {
            var parsed = param.parsed;
            return _async_to_generator(function() {
                return _ts_generator(this, function(_state) {
                    return [
                        2,
                        runCancelContractCommand(parsed)
                    ];
                });
            })();
        }
    },
    {
        name: "tick",
        summary: "Advance one or more ticks",
        run: function run(param) {
            var parsed = param.parsed;
            return _async_to_generator(function() {
                return _ts_generator(this, function(_state) {
                    return [
                        2,
                        runTickCommand(parsed)
                    ];
                });
            })();
        }
    },
    {
        name: "pause",
        summary: "Pause the daemon tick loop",
        run: function run(param) {
            var parsed = param.parsed;
            return _async_to_generator(function() {
                return _ts_generator(this, function(_state) {
                    return [
                        2,
                        runPauseCommand(parsed)
                    ];
                });
            })();
        }
    },
    {
        name: "resume",
        summary: "Resume the daemon tick loop",
        run: function run(param) {
            var parsed = param.parsed;
            return _async_to_generator(function() {
                return _ts_generator(this, function(_state) {
                    return [
                        2,
                        runResumeCommand(parsed)
                    ];
                });
            })();
        }
    },
    {
        name: "speed",
        summary: "Set daemon tick speed",
        run: function run(param) {
            var parsed = param.parsed;
            return _async_to_generator(function() {
                return _ts_generator(this, function(_state) {
                    return [
                        2,
                        runSpeedCommand(parsed)
                    ];
                });
            })();
        }
    }
];
var COMMAND_MAP = new Map(COMMANDS.map(function(command) {
    return [
        command.name,
        command
    ];
}));
export function runCli(args) {
    return _async_to_generator(function() {
        var parsed, runTui, command;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    parsed = parseArgv(args);
                    if (parsed.command === "help" || hasHelpFlag(parsed)) {
                        console.log(formatHelp(COMMANDS));
                        return [
                            2
                        ];
                    }
                    if (!!parsed.command) return [
                        3,
                        3
                    ];
                    return [
                        4,
                        import("./tui/app.js")
                    ];
                case 1:
                    runTui = _state.sent().runTui;
                    return [
                        4,
                        runTui()
                    ];
                case 2:
                    _state.sent();
                    return [
                        2
                    ];
                case 3:
                    command = COMMAND_MAP.get(parsed.command);
                    if (!command) {
                        throw new Error("Unknown command: ".concat(parsed.command, ". Run 'dct --help' for usage."));
                    }
                    return [
                        4,
                        command.run({
                            parsed: parsed
                        })
                    ];
                case 4:
                    _state.sent();
                    return [
                        2
                    ];
            }
        });
    })();
}
export function main() {
    return _async_to_generator(function() {
        var error, message, parsed;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    _state.trys.push([
                        0,
                        2,
                        ,
                        3
                    ]);
                    return [
                        4,
                        runCli(process.argv.slice(2))
                    ];
                case 1:
                    _state.sent();
                    return [
                        3,
                        3
                    ];
                case 2:
                    error = _state.sent();
                    message = _instanceof(error, Error) ? error.message : String(error);
                    parsed = parseArgv(process.argv.slice(2));
                    if (parsed.flags["--json"] === true) {
                        console.error(formatJsonError(message));
                    } else {
                        console.error(message);
                    }
                    process.exit(1);
                    return [
                        3,
                        3
                    ];
                case 3:
                    return [
                        2
                    ];
            }
        });
    })();
}
import { fileURLToPath } from "node:url";
if (import.meta.url.startsWith("file:") && process.argv[1] === fileURLToPath(import.meta.url)) {
    void main();
}
