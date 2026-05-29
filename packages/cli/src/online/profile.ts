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

function normalizeOptionalServerUrl(serverUrl: string | null | undefined): string | null {
  if (!serverUrl) {
    return null;
  }

  const normalized = normalizeServerUrl(serverUrl);
  return normalized.length > 0 ? normalized : null;
}
