import { beforeEach, describe, expect, it } from "vitest";
import {
  clearStoredPlayerIdentity,
  getStoredPlayerIdentity,
  writeStoredPlayerIdentity,
} from "./playerIdentity.js";

const PLAYER_IDENTITY_KEY = "datacenter-tycoon:player-identity-v1";

describe("player identity persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips stored identities with trimmed player ids and usernames", () => {
    writeStoredPlayerIdentity({
      playerId: " 8d8f3b8f-0d43-4d7a-a2d0-8c2b6fd0d927 ",
      username: " Cloud Atlas ",
    });

    expect(JSON.parse(localStorage.getItem(PLAYER_IDENTITY_KEY) ?? "null")).toEqual({
      playerId: "8d8f3b8f-0d43-4d7a-a2d0-8c2b6fd0d927",
      username: "Cloud Atlas",
    });
    expect(getStoredPlayerIdentity()).toEqual({
      playerId: "8d8f3b8f-0d43-4d7a-a2d0-8c2b6fd0d927",
      username: "Cloud Atlas",
    });
  });

  it("ignores invalid stored identities with blank strings", () => {
    localStorage.setItem(
      PLAYER_IDENTITY_KEY,
      JSON.stringify({ playerId: "   ", username: "Cloud Atlas" }),
    );

    expect(getStoredPlayerIdentity()).toBeNull();
  });

  it("clears stored identities", () => {
    writeStoredPlayerIdentity({
      playerId: "8d8f3b8f-0d43-4d7a-a2d0-8c2b6fd0d927",
      username: "Cloud Atlas",
    });

    clearStoredPlayerIdentity();

    expect(getStoredPlayerIdentity()).toBeNull();
  });
});
