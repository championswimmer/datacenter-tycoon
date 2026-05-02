//# hash=4f7976423d6159004f5ea2c2ac3e6abe
//# sourceMappingURL=cli-daemon.test.js.map

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
import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawn } from "node:child_process";
function createTempPaths() {
    var directory = fs.mkdtempSync(path.join(os.tmpdir(), "dct-cli-daemon-"));
    return {
        directory: directory,
        savePath: path.join(directory, "save.json"),
        socketPath: path.join(directory, "dct.sock")
    };
}
function waitForSocket(socketPath, timeoutMs) {
    return _async_to_generator(function() {
        var deadline, unused;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    deadline = Date.now() + timeoutMs;
                    _state.label = 1;
                case 1:
                    if (!(Date.now() < deadline)) return [
                        3,
                        7
                    ];
                    _state.label = 2;
                case 2:
                    _state.trys.push([
                        2,
                        4,
                        ,
                        6
                    ]);
                    return [
                        4,
                        new Promise(function(resolve, reject) {
                            var socket = net.createConnection(socketPath);
                            socket.once("connect", function() {
                                socket.end();
                                resolve();
                            });
                            socket.once("error", function(error) {
                                socket.destroy();
                                reject(error);
                            });
                        })
                    ];
                case 3:
                    _state.sent();
                    return [
                        2
                    ];
                case 4:
                    unused = _state.sent();
                    return [
                        4,
                        new Promise(function(resolve) {
                            return setTimeout(resolve, 50);
                        })
                    ];
                case 5:
                    _state.sent();
                    return [
                        3,
                        6
                    ];
                case 6:
                    return [
                        3,
                        1
                    ];
                case 7:
                    throw new Error("Timed out waiting for socket ".concat(socketPath));
            }
        });
    })();
}
test("cli daemon starts and cli quit shuts it down", function() {
    return _async_to_generator(function() {
        var _createTempPaths, savePath, socketPath, child, quit, quitExitCode, daemonExitCode;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    _createTempPaths = createTempPaths(), savePath = _createTempPaths.savePath, socketPath = _createTempPaths.socketPath;
                    child = spawn(process.execPath, [
                        "--import",
                        "tsx",
                        "src/cli.ts",
                        "daemon",
                        "--save",
                        savePath,
                        "--socket",
                        socketPath,
                        "--idle-timeout",
                        "5000"
                    ], {
                        cwd: process.cwd(),
                        stdio: "ignore"
                    });
                    return [
                        4,
                        waitForSocket(socketPath, 4000)
                    ];
                case 1:
                    _state.sent();
                    quit = spawn(process.execPath, [
                        "--import",
                        "tsx",
                        "src/cli.ts",
                        "quit",
                        "--save",
                        savePath,
                        "--socket",
                        socketPath
                    ], {
                        cwd: process.cwd(),
                        stdio: "pipe"
                    });
                    return [
                        4,
                        new Promise(function(resolve, reject) {
                            quit.once("error", reject);
                            quit.once("exit", function(code) {
                                return resolve(code !== null && code !== void 0 ? code : 1);
                            });
                        })
                    ];
                case 2:
                    quitExitCode = _state.sent();
                    assert.equal(quitExitCode, 0);
                    return [
                        4,
                        new Promise(function(resolve, reject) {
                            if (child.exitCode !== null) {
                                resolve(child.exitCode);
                                return;
                            }
                            var timeout = setTimeout(function() {
                                child.kill("SIGKILL");
                                reject(new Error("Daemon did not exit in time"));
                            }, 3000);
                            child.once("error", function(error) {
                                clearTimeout(timeout);
                                reject(error);
                            });
                            child.once("exit", function(code) {
                                clearTimeout(timeout);
                                resolve(code !== null && code !== void 0 ? code : 1);
                            });
                        })
                    ];
                case 3:
                    daemonExitCode = _state.sent();
                    assert.equal(daemonExitCode, 0);
                    assert.equal(fs.existsSync(savePath), true);
                    return [
                        2
                    ];
            }
        });
    })();
});
