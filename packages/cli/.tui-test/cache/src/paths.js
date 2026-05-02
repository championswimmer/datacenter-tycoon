//# hash=260965fd04b34c0b0b2182348beab6d5
//# sourceMappingURL=paths.js.map

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
function _object_spread(target) {
    for(var i = 1; i < arguments.length; i++){
        var source = arguments[i] != null ? arguments[i] : {};
        var ownKeys = Object.keys(source);
        if (typeof Object.getOwnPropertySymbols === "function") {
            ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function(sym) {
                return Object.getOwnPropertyDescriptor(source, sym).enumerable;
            }));
        }
        ownKeys.forEach(function(key) {
            _define_property(target, key, source[key]);
        });
    }
    return target;
}
function ownKeys(object, enumerableOnly) {
    var keys = Object.keys(object);
    if (Object.getOwnPropertySymbols) {
        var symbols = Object.getOwnPropertySymbols(object);
        if (enumerableOnly) {
            symbols = symbols.filter(function(sym) {
                return Object.getOwnPropertyDescriptor(object, sym).enumerable;
            });
        }
        keys.push.apply(keys, symbols);
    }
    return keys;
}
function _object_spread_props(target, source) {
    source = source != null ? source : {};
    if (Object.getOwnPropertyDescriptors) {
        Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
        ownKeys(Object(source)).forEach(function(key) {
            Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
        });
    }
    return target;
}
import os from "node:os";
import path from "node:path";
function getPathApi(platform) {
    return platform === "win32" ? path.win32 : path.posix;
}
function resolveDataDir(platform, env, homeDir) {
    var _env_XDG_DATA_HOME;
    var pathApi = getPathApi(platform);
    if (platform === "win32") {
        var _env_APPDATA;
        return (_env_APPDATA = env.APPDATA) !== null && _env_APPDATA !== void 0 ? _env_APPDATA : pathApi.join(homeDir, "AppData", "Roaming");
    }
    if (platform === "darwin") {
        return pathApi.join(homeDir, "Library", "Application Support");
    }
    return (_env_XDG_DATA_HOME = env.XDG_DATA_HOME) !== null && _env_XDG_DATA_HOME !== void 0 ? _env_XDG_DATA_HOME : pathApi.join(homeDir, ".local", "share");
}
function resolveRuntimeDir(platform, env, homeDir, tempDir) {
    var _env_XDG_RUNTIME_DIR;
    var pathApi = getPathApi(platform);
    if (platform === "win32") {
        return "\\\\.\\pipe";
    }
    if (platform === "darwin") {
        return tempDir;
    }
    return (_env_XDG_RUNTIME_DIR = env.XDG_RUNTIME_DIR) !== null && _env_XDG_RUNTIME_DIR !== void 0 ? _env_XDG_RUNTIME_DIR : pathApi.join(homeDir, ".local", "state");
}
function resolveLogDir(platform, env, homeDir) {
    var _env_XDG_STATE_HOME;
    var pathApi = getPathApi(platform);
    if (platform === "win32") {
        var _env_LOCALAPPDATA;
        return pathApi.join((_env_LOCALAPPDATA = env.LOCALAPPDATA) !== null && _env_LOCALAPPDATA !== void 0 ? _env_LOCALAPPDATA : pathApi.join(homeDir, "AppData", "Local"), "dct", "Logs");
    }
    if (platform === "darwin") {
        return pathApi.join(homeDir, "Library", "Logs", "dct");
    }
    return pathApi.join((_env_XDG_STATE_HOME = env.XDG_STATE_HOME) !== null && _env_XDG_STATE_HOME !== void 0 ? _env_XDG_STATE_HOME : pathApi.join(homeDir, ".local", "state"), "dct");
}
export function resolvePathsForPlatform(options) {
    var platform = options.platform, env = options.env, homeDir = options.homeDir, tempDir = options.tempDir, saveOverride = options.saveOverride, gameId = options.gameId, socketOverride = options.socketOverride;
    var pathApi = getPathApi(platform);
    var dataDir = pathApi.join(resolveDataDir(platform, env, homeDir), "dct");
    var saveFileName = gameId ? "".concat(gameId, ".json") : "save.json";
    var savePath = saveOverride !== null && saveOverride !== void 0 ? saveOverride : pathApi.join(dataDir, saveFileName);
    var socketPath = socketOverride !== null && socketOverride !== void 0 ? socketOverride : platform === "win32" ? "\\\\.\\pipe\\dct" : pathApi.join(resolveRuntimeDir(platform, env, homeDir, tempDir), "dct", "dct.sock");
    var pidPath = platform === "win32" ? "\\\\.\\pipe\\dct.pid" : "".concat(socketPath, ".pid");
    var logPath = pathApi.join(resolveLogDir(platform, env, homeDir), "daemon.log");
    return {
        savePath: savePath,
        dataDir: dataDir,
        socketPath: socketPath,
        pidPath: pidPath,
        logPath: logPath
    };
}
export function resolvePaths() {
    var options = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    return resolvePathsForPlatform(_object_spread_props(_object_spread({}, options), {
        platform: process.platform,
        env: process.env,
        homeDir: os.homedir(),
        tempDir: os.tmpdir()
    }));
}
