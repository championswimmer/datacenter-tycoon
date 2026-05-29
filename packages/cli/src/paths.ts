import os from "node:os";
import path from "node:path";

export interface ResolvePathsOptions {
  saveOverride?: string;
  gameId?: string;
  socketOverride?: string;
}

interface ResolvePathsPlatformOptions extends ResolvePathsOptions {
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  homeDir: string;
  tempDir: string;
}

export interface ResolvedPaths {
  savePath: string;
  dataDir: string;
  configDir: string;
  onlineProfilePath: string;
  socketPath: string;
  pidPath: string;
  logPath: string;
}

function getPathApi(platform: NodeJS.Platform): typeof path.posix | typeof path.win32 {
  return platform === "win32" ? path.win32 : path.posix;
}

function resolveDataDir(platform: NodeJS.Platform, env: NodeJS.ProcessEnv, homeDir: string): string {
  const pathApi = getPathApi(platform);

  if (platform === "win32") {
    return env.APPDATA ?? pathApi.join(homeDir, "AppData", "Roaming");
  }

  if (platform === "darwin") {
    return pathApi.join(homeDir, "Library", "Application Support");
  }

  return env.XDG_DATA_HOME ?? pathApi.join(homeDir, ".local", "share");
}

function resolveConfigDir(platform: NodeJS.Platform, env: NodeJS.ProcessEnv, homeDir: string): string {
  const pathApi = getPathApi(platform);

  if (platform === "win32") {
    return env.APPDATA ?? pathApi.join(homeDir, "AppData", "Roaming");
  }

  if (platform === "darwin") {
    return pathApi.join(homeDir, "Library", "Application Support");
  }

  return env.XDG_CONFIG_HOME ?? pathApi.join(homeDir, ".config");
}

function resolveRuntimeDir(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
  homeDir: string,
  tempDir: string,
): string {
  const pathApi = getPathApi(platform);

  if (platform === "win32") {
    return "\\\\.\\pipe";
  }

  if (platform === "darwin") {
    return tempDir;
  }

  return env.XDG_RUNTIME_DIR ?? pathApi.join(homeDir, ".local", "state");
}

function resolveLogDir(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
  homeDir: string,
): string {
  const pathApi = getPathApi(platform);

  if (platform === "win32") {
    return pathApi.join(env.LOCALAPPDATA ?? pathApi.join(homeDir, "AppData", "Local"), "dct", "Logs");
  }

  if (platform === "darwin") {
    return pathApi.join(homeDir, "Library", "Logs", "dct");
  }

  return pathApi.join(env.XDG_STATE_HOME ?? pathApi.join(homeDir, ".local", "state"), "dct");
}

export function resolvePathsForPlatform(options: ResolvePathsPlatformOptions): ResolvedPaths {
  const { platform, env, homeDir, tempDir, saveOverride, gameId, socketOverride } = options;
  const pathApi = getPathApi(platform);

  const dataDir = pathApi.join(resolveDataDir(platform, env, homeDir), "dct");
  const configDir = pathApi.join(resolveConfigDir(platform, env, homeDir), "dct");
  const saveFileName = gameId ? `${gameId}.json` : "save.json";
  const savePath = saveOverride ?? pathApi.join(dataDir, saveFileName);
  const onlineProfilePath = pathApi.join(configDir, "online-profile.json");

  const socketPath =
    socketOverride ??
    (platform === "win32"
      ? "\\\\.\\pipe\\dct"
      : pathApi.join(resolveRuntimeDir(platform, env, homeDir, tempDir), "dct", "dct.sock"));

  const pidPath = platform === "win32" ? "\\\\.\\pipe\\dct.pid" : `${socketPath}.pid`;
  const logPath = pathApi.join(resolveLogDir(platform, env, homeDir), "daemon.log");

  return {
    savePath,
    dataDir,
    configDir,
    onlineProfilePath,
    socketPath,
    pidPath,
    logPath,
  };
}

export function resolvePaths(options: ResolvePathsOptions = {}): ResolvedPaths {
  return resolvePathsForPlatform({
    ...options,
    platform: process.platform,
    env: process.env,
    homeDir: os.homedir(),
    tempDir: os.tmpdir(),
  });
}
