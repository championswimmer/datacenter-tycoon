import { BACKEND_API_URL } from "./backend.js";

export interface OnlineApiEnvironment {
  readonly DEV?: boolean;
  readonly MODE?: string;
  readonly VITE_API_BASE_URL?: string;
}

export const ONLINE_API_BASE_URL_ENV = "VITE_API_BASE_URL";
export const DEFAULT_DEV_API_BASE_URL = "http://localhost:3000";

export function resolveOnlineApiBaseUrl(
  env: OnlineApiEnvironment = import.meta.env,
): string | null {
  const configured = normalizeOptionalBaseUrl(env[ONLINE_API_BASE_URL_ENV]);
  if (configured) {
    return configured;
  }

  if (env.MODE === "development") {
    return DEFAULT_DEV_API_BASE_URL;
  }

  if (env.MODE === "production") {
    // An explicitly blank VITE_API_BASE_URL still means "offline build"; only an unset one falls back to the constant.
    return env[ONLINE_API_BASE_URL_ENV] === undefined
      ? normalizeOptionalBaseUrl(BACKEND_API_URL)
      : null;
  }

  if (env.MODE === "test") {
    return null;
  }

  if (env.DEV === true) {
    return DEFAULT_DEV_API_BASE_URL;
  }

  return null;
}

function normalizeOptionalBaseUrl(baseUrl: string | undefined): string | null {
  if (!baseUrl) {
    return null;
  }

  const normalized = baseUrl.trim().replace(/\/+$/, "");
  return normalized.length > 0 ? normalized : null;
}
