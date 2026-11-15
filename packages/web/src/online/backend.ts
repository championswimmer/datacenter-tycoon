/**
 * Backends the web client can talk to. Both expose the identical HTTP API and share one database.
 * - v1: the TypeScript (Bun/Elysia) server
 * - v2: the Go server (packages/server-go)
 */
export const BACKEND_API_URLS = {
  v1: "https://dctycoon-api-production.up.railway.app",
  v2: "https://dctycoon-api-v2-production.up.railway.app",
} as const;

/**
 * The backend used by production builds (GitHub Pages). Switch the API by changing this one value
 * to `BACKEND_API_URLS.v2`. A `VITE_API_BASE_URL` build-time env var still overrides it.
 */
export const BACKEND_API_URL: string = BACKEND_API_URLS.v1;
