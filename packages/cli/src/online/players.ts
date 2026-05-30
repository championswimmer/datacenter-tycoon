import { normalizeServerUrl, type CliOnlineProfile } from "./profile.js";

export interface RegisterPlayerOptions {
  serverUrl: string | null;
  username: string;
}

export class PlayerRegistrationError extends Error {
  readonly code: string;
  readonly status: number | null;

  constructor(message: string, options: { code: string; status?: number | null }) {
    super(message);
    this.name = "PlayerRegistrationError";
    this.code = options.code;
    this.status = options.status ?? null;
  }
}

export async function registerPlayer(
  options: RegisterPlayerOptions,
  fetchImpl: typeof fetch = fetch,
): Promise<CliOnlineProfile> {
  const baseUrl = normalizeOptionalServerUrl(options.serverUrl);

  if (!baseUrl) {
    throw new PlayerRegistrationError("Online sync is disabled because no server URL is configured.", {
      code: "ONLINE_SYNC_DISABLED",
    });
  }

  let response: Response;

  try {
    response = await fetchImpl(new URL("/players", `${baseUrl}/`).toString(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ username: options.username }),
    });
  } catch (error) {
    throw new PlayerRegistrationError(
      error instanceof Error ? error.message : "Could not reach the online leaderboard service.",
      {
        code: "NETWORK_ERROR",
      },
    );
  }

  const payload = await readJsonBody(response);

  if (!response.ok) {
    const apiError = isApiErrorPayload(payload) ? payload.error : null;
    throw new PlayerRegistrationError(
      apiError?.message ?? `Player registration failed with status ${response.status}.`,
      {
        code: apiError?.code ?? "REGISTRATION_FAILED",
        status: response.status,
      },
    );
  }

  if (!isPlayerRegistrationPayload(payload)) {
    throw new PlayerRegistrationError("Player registration returned an invalid response.", {
      code: "INVALID_RESPONSE",
      status: response.status,
    });
  }

  return {
    serverUrl: baseUrl,
    playerId: payload.playerId,
    username: payload.username,
  };
}

export function isRegistrationUnavailableError(error: unknown): boolean {
  if (!(error instanceof PlayerRegistrationError)) {
    return false;
  }

  if (
    error.code === "INVALID_USERNAME"
    || error.code === "USERNAME_UNAVAILABLE"
    || error.code === "INVALID_JSON"
  ) {
    return false;
  }

  return error.status === null || error.status >= 500;
}

function normalizeOptionalServerUrl(serverUrl: string | null | undefined): string | null {
  if (!serverUrl) {
    return null;
  }

  const normalized = normalizeServerUrl(serverUrl);
  return normalized.length > 0 ? normalized : null;
}

function isPlayerRegistrationPayload(
  payload: unknown,
): payload is Pick<CliOnlineProfile, "playerId" | "username"> {
  return Boolean(payload)
    && typeof payload === "object"
    && typeof (payload as { playerId?: unknown }).playerId === "string"
    && typeof (payload as { username?: unknown }).username === "string";
}

function isApiErrorPayload(payload: unknown): payload is { error: { code: string; message: string } } {
  return Boolean(payload)
    && typeof payload === "object"
    && typeof (payload as { error?: { code?: unknown; message?: unknown } }).error?.code === "string"
    && typeof (payload as { error?: { code?: unknown; message?: unknown } }).error?.message === "string";
}

async function readJsonBody(response: Response): Promise<unknown> {
  const bodyText = await response.text();

  if (!bodyText) {
    return null;
  }

  try {
    return JSON.parse(bodyText) as unknown;
  } catch {
    return null;
  }
}
