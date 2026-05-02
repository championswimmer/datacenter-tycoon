//# hash=94f69b492d31a397e625135fe452a947
//# sourceMappingURL=transport.js.map

function _assert_this_initialized(self) {
    if (self === void 0) {
        throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }
    return self;
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
function _call_super(_this, derived, args) {
    derived = _get_prototype_of(derived);
    return _possible_constructor_return(_this, _is_native_reflect_construct() ? Reflect.construct(derived, args || [], _get_prototype_of(_this).constructor) : derived.apply(_this, args));
}
function _class_call_check(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
    }
}
function _defineProperties(target, props) {
    for(var i = 0; i < props.length; i++){
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
    }
}
function _create_class(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties(Constructor, staticProps);
    return Constructor;
}
function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
}
function _get_prototype_of(o) {
    _get_prototype_of = Object.setPrototypeOf ? Object.getPrototypeOf : function getPrototypeOf(o) {
        return o.__proto__ || Object.getPrototypeOf(o);
    };
    return _get_prototype_of(o);
}
function _inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
        throw new TypeError("Super expression must either be null or a function");
    }
    subClass.prototype = Object.create(superClass && superClass.prototype, {
        constructor: {
            value: subClass,
            writable: true,
            configurable: true
        }
    });
    if (superClass) _set_prototype_of(subClass, superClass);
}
function _possible_constructor_return(self, call) {
    if (call && (_type_of(call) === "object" || typeof call === "function")) {
        return call;
    }
    return _assert_this_initialized(self);
}
function _set_prototype_of(o, p) {
    _set_prototype_of = Object.setPrototypeOf || function setPrototypeOf(o, p) {
        o.__proto__ = p;
        return o;
    };
    return _set_prototype_of(o, p);
}
function _type_of(obj) {
    "@swc/helpers - typeof";
    return obj && typeof Symbol !== "undefined" && obj.constructor === Symbol ? "symbol" : typeof obj;
}
function _is_native_reflect_construct() {
    try {
        var result = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function() {}));
    } catch (_) {}
    return (_is_native_reflect_construct = function() {
        return !!result;
    })();
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
import net from "node:net";
import path from "node:path";
import { EventEmitter, once } from "node:events";
export var DaemonTransport = /*#__PURE__*/ function(EventEmitter) {
    "use strict";
    _inherits(DaemonTransport, EventEmitter);
    function DaemonTransport(options) {
        _class_call_check(this, DaemonTransport);
        var _this;
        _this = _call_super(this, DaemonTransport), _define_property(_this, "socketPath", void 0), _define_property(_this, "server", void 0), _define_property(_this, "connections", new Map()), _define_property(_this, "buffers", new Map()), _define_property(_this, "nextConnectionId", 1);
        _this.socketPath = options.socketPath;
        _this.server = net.createServer(function(socket) {
            var connection = {
                id: _this.nextConnectionId,
                socket: socket
            };
            _this.nextConnectionId += 1;
            _this.connections.set(socket, connection);
            _this.buffers.set(socket, "");
            _this.emit("connection", connection);
            socket.on("data", function(chunk) {
                _this.handleData(connection, chunk);
            });
            socket.on("close", function() {
                _this.connections.delete(socket);
                _this.buffers.delete(socket);
                _this.emit("disconnect", connection);
            });
            socket.on("error", function(error) {
                _this.emit("error", error);
            });
        });
        _this.server.on("error", function(error) {
            _this.emit("error", error);
        });
        return _this;
    }
    _create_class(DaemonTransport, [
        {
            key: "start",
            value: function start() {
                return _async_to_generator(function() {
                    return _ts_generator(this, function(_state) {
                        switch(_state.label){
                            case 0:
                                if (process.platform !== "win32") {
                                    fs.mkdirSync(path.dirname(this.socketPath), {
                                        recursive: true
                                    });
                                    if (fs.existsSync(this.socketPath)) {
                                        fs.rmSync(this.socketPath, {
                                            force: true
                                        });
                                    }
                                }
                                this.server.listen(this.socketPath);
                                return [
                                    4,
                                    once(this.server, "listening")
                                ];
                            case 1:
                                _state.sent();
                                return [
                                    2
                                ];
                        }
                    });
                }).call(this);
            }
        },
        {
            key: "close",
            value: function close() {
                return _async_to_generator(function() {
                    var _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, connection;
                    return _ts_generator(this, function(_state) {
                        switch(_state.label){
                            case 0:
                                _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                                try {
                                    for(_iterator = this.connections.values()[Symbol.iterator](); !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                                        connection = _step.value;
                                        connection.socket.destroy();
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
                                this.connections.clear();
                                this.buffers.clear();
                                if (!this.server.listening) return [
                                    3,
                                    2
                                ];
                                this.server.close();
                                return [
                                    4,
                                    once(this.server, "close")
                                ];
                            case 1:
                                _state.sent();
                                _state.label = 2;
                            case 2:
                                if (process.platform !== "win32" && fs.existsSync(this.socketPath)) {
                                    fs.rmSync(this.socketPath, {
                                        force: true
                                    });
                                }
                                return [
                                    2
                                ];
                        }
                    });
                }).call(this);
            }
        },
        {
            key: "send",
            value: function send(connection, message) {
                return connection.socket.write("".concat(JSON.stringify(message), "\n"));
            }
        },
        {
            key: "handleData",
            value: function handleData(connection, chunk) {
                var _this_buffers_get, _lines_pop;
                var previousBuffer = (_this_buffers_get = this.buffers.get(connection.socket)) !== null && _this_buffers_get !== void 0 ? _this_buffers_get : "";
                var buffer = "".concat(previousBuffer).concat(chunk.toString());
                var lines = buffer.split("\n");
                var remainder = (_lines_pop = lines.pop()) !== null && _lines_pop !== void 0 ? _lines_pop : "";
                this.buffers.set(connection.socket, remainder);
                var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                try {
                    for(var _iterator = lines[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
                        var line = _step.value;
                        var trimmed = line.trim();
                        if (!trimmed) {
                            continue;
                        }
                        try {
                            var request = JSON.parse(trimmed);
                            this.emit("request", connection, request);
                        } catch (error) {
                            this.emit("invalidMessage", connection, trimmed, error);
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
            }
        }
    ]);
    return DaemonTransport;
}(EventEmitter);
