import { DctClient } from "../client/client.js";
import type { ParsedArgv } from "../argv.js";
import {
  clearOnlineProfile,
  readOnlineProfile,
  resolveOnlineTarget,
  writeOnlineProfile,
  type CliOnlineProfile,
} from "../online/profile.js";
import {
  registerPlayer,
  type RegisterPlayerOptions,
} from "../online/players.js";
import {
  formatOnlineSyncNote,
  syncLeaderboardFromCommand,
  type CliOnlineSyncDependencies,
} from "../online/sync.js";
import {
  getStringFlag,
  resolveCommandPaths,
  withClient,
  writeCommandResult,
  type CommandClientFactory,
  type CommandPaths,
} from "./common.js";

export interface OnlineCommandDependencies {
  env?: NodeJS.ProcessEnv;
  resolvePaths?: (parsed: ParsedArgv) => Pick<CommandPaths, "onlineProfilePath">;
  readProfile?: typeof readOnlineProfile;
  writeProfile?: typeof writeOnlineProfile;
  clearProfile?: typeof clearOnlineProfile;
  registerPlayer?: (
    options: RegisterPlayerOptions,
    fetchImpl?: typeof fetch,
  ) => Promise<CliOnlineProfile>;
  clientFactory?: CommandClientFactory;
  syncLeaderboard?: typeof syncLeaderboardFromCommand;
  syncDependencies?: CliOnlineSyncDependencies;
  fetchImpl?: typeof fetch;
}

function withShiftedPositionals(parsed: ParsedArgv, count: number): ParsedArgv {
  return {
    ...parsed,
    positionals: parsed.positionals.slice(count),
  };
}

function resolveOnlineDependencies(dependencies: OnlineCommandDependencies = {}): Required<OnlineCommandDependencies> {
  return {
    env: dependencies.env ?? process.env,
    resolvePaths: dependencies.resolvePaths ?? resolveCommandPaths,
    readProfile: dependencies.readProfile ?? readOnlineProfile,
    writeProfile: dependencies.writeProfile ?? writeOnlineProfile,
    clearProfile: dependencies.clearProfile ?? clearOnlineProfile,
    registerPlayer: dependencies.registerPlayer ?? registerPlayer,
    clientFactory: dependencies.clientFactory ?? ((options) => new DctClient(options)),
    syncLeaderboard: dependencies.syncLeaderboard ?? syncLeaderboardFromCommand,
    syncDependencies: dependencies.syncDependencies ?? {},
    fetchImpl: dependencies.fetchImpl ?? fetch,
  };
}

export async function runOnlineLoginCommand(
  parsed: ParsedArgv,
  dependencies: OnlineCommandDependencies = {},
): Promise<void> {
  const username = getStringFlag(parsed, "--username")?.trim();

  if (!username) {
    throw new Error("Usage: dct online login --username <name> [--server <url>]");
  }

  const resolved = resolveOnlineDependencies(dependencies);
  const { onlineProfilePath } = resolved.resolvePaths(parsed);
  const storedProfile = await resolved.readProfile(onlineProfilePath);
  const target = resolveOnlineTarget({
    flagServerUrl: getStringFlag(parsed, "--server"),
    profile: storedProfile,
    env: resolved.env,
  });
  const profile = await resolved.registerPlayer(
    {
      serverUrl: target.serverUrl,
      username,
    },
    resolved.fetchImpl,
  );
  const persistedProfile = await resolved.writeProfile(onlineProfilePath, profile);

  writeCommandResult(
    parsed,
    `Logged in as ${persistedProfile.username} (${persistedProfile.playerId}) via ${persistedProfile.serverUrl}`,
    {
      profile: persistedProfile,
      target: {
        serverUrl: persistedProfile.serverUrl,
        source: target.source,
      },
      profilePath: onlineProfilePath,
    },
  );
}

export async function runOnlineStatusCommand(
  parsed: ParsedArgv,
  dependencies: OnlineCommandDependencies = {},
): Promise<void> {
  const resolved = resolveOnlineDependencies(dependencies);
  const { onlineProfilePath } = resolved.resolvePaths(parsed);
  const profile = await resolved.readProfile(onlineProfilePath);
  const target = resolveOnlineTarget({
    flagServerUrl: getStringFlag(parsed, "--server"),
    profile,
    env: resolved.env,
  });

  const message = profile
    ? `Online profile: ${profile.username} (${profile.playerId}) via ${profile.serverUrl} [active target: ${target.serverUrl ?? "disabled"} from ${target.source}]`
    : target.serverUrl
      ? `No stored online profile. Active server override: ${target.serverUrl} (${target.source}).`
      : "Online sync is not configured.";

  writeCommandResult(parsed, message, {
    loggedIn: profile !== null,
    profile,
    target,
    profilePath: onlineProfilePath,
  });
}

export async function runOnlineLogoutCommand(
  parsed: ParsedArgv,
  dependencies: OnlineCommandDependencies = {},
): Promise<void> {
  const resolved = resolveOnlineDependencies(dependencies);
  const { onlineProfilePath } = resolved.resolvePaths(parsed);
  const existingProfile = await resolved.readProfile(onlineProfilePath);
  await resolved.clearProfile(onlineProfilePath);

  writeCommandResult(
    parsed,
    existingProfile
      ? `Cleared online profile for ${existingProfile.username}`
      : "No online profile was configured.",
    {
      cleared: existingProfile !== null,
      profile: existingProfile,
      profilePath: onlineProfilePath,
    },
  );
}

export async function runOnlineSubmitCommand(
  parsed: ParsedArgv,
  dependencies: OnlineCommandDependencies = {},
): Promise<void> {
  const resolved = resolveOnlineDependencies(dependencies);
  const sync = await withClient(
    parsed,
    async (client, paths) =>
      resolved.syncLeaderboard(parsed, client, paths, resolved.syncDependencies),
    resolved.clientFactory,
  );

  writeCommandResult(
    parsed,
    formatOnlineSyncNote(sync, { includeSkipped: true }) ?? sync.message,
    {
      onlineSync: sync,
    },
  );
}

export async function runOnlineCommand(
  parsed: ParsedArgv,
  dependencies: OnlineCommandDependencies = {},
): Promise<void> {
  const subcommand = parsed.positionals[0];
  const nestedParsed = withShiftedPositionals(parsed, 1);

  if (subcommand === "login") {
    await runOnlineLoginCommand(nestedParsed, dependencies);
    return;
  }

  if (subcommand === "status") {
    await runOnlineStatusCommand(nestedParsed, dependencies);
    return;
  }

  if (subcommand === "logout") {
    await runOnlineLogoutCommand(nestedParsed, dependencies);
    return;
  }

  if (subcommand === "submit") {
    await runOnlineSubmitCommand(nestedParsed, dependencies);
    return;
  }

  throw new Error(
    "Usage: dct online <subcommand>\n\n"
      + "Subcommands:\n"
      + "  login --username <name> [--server <url>]   Register/login against the online leaderboard service\n"
      + "  status [--server <url>]                     Show the stored online identity and active server target\n"
      + "  logout                                      Clear the stored online identity\n"
      + "  submit                                      Submit the current run summary to the online leaderboard",
  );
}
