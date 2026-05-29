import { describe, expect, it } from "vitest";

import {
  DEFAULT_DEV_API_BASE_URL,
  resolveOnlineApiBaseUrl,
} from "./config.js";

describe("resolveOnlineApiBaseUrl", () => {
  it("prefers an explicit VITE_API_BASE_URL override", () => {
    expect(resolveOnlineApiBaseUrl({
      DEV: true,
      MODE: "development",
      VITE_API_BASE_URL: " https://api.dctycoon.test/ ",
    })).toBe("https://api.dctycoon.test");
  });

  it("defaults development to localhost when no override is configured", () => {
    expect(resolveOnlineApiBaseUrl({
      DEV: true,
      MODE: "development",
    })).toBe(DEFAULT_DEV_API_BASE_URL);
  });

  it("keeps production offline when no API URL is configured", () => {
    expect(resolveOnlineApiBaseUrl({
      DEV: false,
      MODE: "production",
    })).toBeNull();
  });
});
