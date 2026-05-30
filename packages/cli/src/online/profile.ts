import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface CliOnlineProfile {
  serverUrl: string;
  playerId: string;
  username: string;
}

export type ResolvedOnlineTargetSource = "flag" | "profile" | "env" | "disabled";

export interface ResolvedOnlineTarget {
  serverUrl: string | null;
  source: ResolvedOnlineTargetSource;
}

export interface ResolveOnlineTargetOptions {
  flagServerUrl?: string | null;
  profile?: Pick<CliOnlineProfile, "serverUrl"> | null;
  env?: NodeJS.ProcessEnv;
}

export class CliOnlineProfileError extends Error {
  readonly code: string;
  readonly profilePath: string;

  constructor(message: string, options: { code: string; profilePath: string }) {
    super(message);
    this.name = "CliOnlineProfileError";
    this.code = options.code;
    this.profilePath = options.profilePath;
  }
}

export const CLI_ONLINE_SERVER_ENV = "DCT_SERVER_URL";
export const ONLINE_COMMAND_SUMMARY = "Online subcommands (login, status, logout, submit)";

export function normalizeServerUrl(serverUrl: string): string {
  return serverUrl.trim().replace(/\/+$/, "");
}

export function resolveOnlineTarget(options: ResolveOnlineTargetOptions = {}): ResolvedOnlineTarget {
  const flagServerUrl = normalizeOptionalServerUrl(options.flagServerUrl);
  if (flagServerUrl) {
    return {
      serverUrl: flagServerUrl,
      source: "flag",
    };
  }

  const profileServerUrl = normalizeOptionalServerUrl(options.profile?.serverUrl);
  if (profileServerUrl) {
    return {
      serverUrl: profileServerUrl,
      source: "profile",
    };
  }

  const envServerUrl = normalizeOptionalServerUrl(options.env?.[CLI_ONLINE_SERVER_ENV]);
  if (envServerUrl) {
    return {
      serverUrl: envServerUrl,
      source: "env",
    };
  }

  return {
    serverUrl: null,
    source: "disabled",
  };
}

export async function readOnlineProfile(profilePath: string): Promise<CliOnlineProfile | null> {
  try {
    const rawProfile = await readFile(profilePath, "utf8");
    const parsedProfile = JSON.parse(rawProfile) as unknown;
    return parseCliOnlineProfile(parsedProfile, profilePath);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return null;
    }

    if (error instanceof CliOnlineProfileError) {
      throw error;
    }

    throw new CliOnlineProfileError("Online profile is invalid or unreadable.", {
      code: "INVALID_ONLINE_PROFILE",
      profilePath,
    });
  }
}

export async function writeOnlineProfile(
  profilePath: string,
  profile: CliOnlineProfile,
): Promise<CliOnlineProfile> {
  const normalizedProfile = parseCliOnlineProfile(profile, profilePath);
  await mkdir(dirname(profilePath), { recursive: true });
  await writeFile(profilePath, `${JSON.stringify(normalizedProfile, null, 2)}\n`, "utf8");
  return normalizedProfile;
}

export async function clearOnlineProfile(profilePath: string): Promise<void> {
  await rm(profilePath, { force: true });
}

function parseCliOnlineProfile(payload: unknown, profilePath: string): CliOnlineProfile {
  if (!payload || typeof payload !== "object") {
    throw new CliOnlineProfileError("Online profile must be a JSON object.", {
      code: "INVALID_ONLINE_PROFILE",
      profilePath,
    });
  }

  const { serverUrl, playerId, username } = payload as Partial<CliOnlineProfile>;

  if (typeof serverUrl !== "string" || typeof playerId !== "string" || typeof username !== "string") {
    throw new CliOnlineProfileError("Online profile must include string serverUrl, playerId, and username fields.", {
      code: "INVALID_ONLINE_PROFILE",
      profilePath,
    });
  }

  const normalizedServerUrl = normalizeOptionalServerUrl(serverUrl);
  const normalizedPlayerId = playerId.trim();
  const normalizedUsername = username.trim();

  if (!normalizedServerUrl || !normalizedPlayerId || !normalizedUsername) {
    throw new CliOnlineProfileError("Online profile fields must not be blank.", {
      code: "INVALID_ONLINE_PROFILE",
      profilePath,
    });
  }

  return {
    serverUrl: normalizedServerUrl,
    playerId: normalizedPlayerId,
    username: normalizedUsername,
  };
}

function normalizeOptionalServerUrl(serverUrl: string | null | undefined): string | null {
  if (!serverUrl) {
    return null;
  }

  const normalized = normalizeServerUrl(serverUrl);
  return normalized.length > 0 ? normalized : null;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error !== null && typeof error === "object" && "code" in error;
}
