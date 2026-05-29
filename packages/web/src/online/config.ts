export interface OnlineApiEnvironment {
  readonly DEV?: boolean;
  readonly MODE?: string;
  readonly VITE_API_BASE_URL?: string;
}

export const DEFAULT_DEV_API_BASE_URL = "http://localhost:3000";

export function resolveOnlineApiBaseUrl(
  env: OnlineApiEnvironment = import.meta.env,
): string | null {
  const configured = normalizeOptionalBaseUrl(env.VITE_API_BASE_URL);
  if (configured) {
    return configured;
  }

  if (env.DEV === true || env.MODE === "development") {
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
