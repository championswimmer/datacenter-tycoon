import { describe, expect, it } from "vitest";

import {
  DEFAULT_DEV_API_BASE_URL,
  ONLINE_API_BASE_URL_ENV,
  resolveOnlineApiBaseUrl,
} from "./config.js";

describe("resolveOnlineApiBaseUrl", () => {
  it("prefers an explicit VITE_API_BASE_URL override", () => {
    expect(resolveOnlineApiBaseUrl({
      DEV: true,
      MODE: "development",
      [ONLINE_API_BASE_URL_ENV]: " https://api.dctycoon.test/ ",
    })).toBe("https://api.dctycoon.test");
  });

  it("defaults development to localhost when no override is configured", () => {
    expect(resolveOnlineApiBaseUrl({
      DEV: true,
      MODE: "development",
    })).toBe(DEFAULT_DEV_API_BASE_URL);
  });

  it("keeps production pointed at the explicitly configured API", () => {
    expect(resolveOnlineApiBaseUrl({
      DEV: false,
      MODE: "production",
      [ONLINE_API_BASE_URL_ENV]: " https://prod.api.dctycoon.test/ ",
    })).toBe("https://prod.api.dctycoon.test");
  });

  it("lets an explicit non-development mode win over the Vite DEV flag", () => {
    expect(resolveOnlineApiBaseUrl({
      DEV: true,
      MODE: "production",
    })).toBeNull();
  });

  it("keeps production offline when no API URL is configured", () => {
    expect(resolveOnlineApiBaseUrl({
      DEV: false,
      MODE: "production",
    })).toBeNull();
  });
});
