import { beforeEach, describe, expect, it, vi } from "vitest";
import { newGame } from "@datacenter-tycoon/game-logic";
import {
  buildLeaderboardRunSubmission,
  fetchLeaderboard,
  LeaderboardQueryError,
  LeaderboardSubmissionError,
  submitLeaderboardRun,
} from "./leaderboard.js";

const PLAYER_ID = "8d8f3b8f-0d43-4d7a-a2d0-8c2b6fd0d927";

describe("online leaderboard", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.dctycoon.test");
  });

  it("buildLeaderboardRunSubmission rounds shared metrics to backend-safe integers", () => {
    const state = newGame(123, { playerName: "Acme Cloud" });
    state.tick = 3;
    state.player.cash = 1_500_000.75;
    state.ledger.push({
      id: "ledger-1" as (typeof state.ledger)[number]["id"],
      tick: 1,
      type: "revenue",
      amount: 99.6,
      reason: "contract revenue",
    });

    expect(buildLeaderboardRunSubmission(PLAYER_ID, state)).toEqual({
      playerId: PLAYER_ID,
      clientRunId: state.gameId,
      metrics: {
        money: 1_500_001,
        cumulativeRevenue: 100,
        totalServers: 0,
        computeCapacity: 0,
        memoryCapacity: 0,
        storageCapacity: 0,
        gpuCapacity: 0,
      },
      gameMonth: 3,
    });
  });

  it("fetchLeaderboard requests the default start-screen leaderboard", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({
        metric: "money",
        period: "all-time",
        limit: 10,
        entries: [
          {
            rank: 1,
            playerId: PLAYER_ID,
            username: "Acme Cloud",
            metric: "money",
            value: 1_750_000,
            submittedAt: "2026-05-18T12:00:00.000Z",
            gameMonth: 12,
            metrics: {
              money: 1_750_000,
              cumulativeRevenue: 300_000,
              totalServers: 8,
              computeCapacity: 400,
              memoryCapacity: 512,
              storageCapacity: 128,
              gpuCapacity: 16,
            },
          },
        ],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await fetchLeaderboard(undefined, fetchMock);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.dctycoon.test/leaderboard?metric=money&period=all-time&limit=10",
    );
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.username).toBe("Acme Cloud");
  });

  it("fetchLeaderboard surfaces structured API errors", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({
        error: {
          code: "LEADERBOARD_UNAVAILABLE",
          message: "Online leaderboard submission is not configured.",
        },
      }), {
        status: 503,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(fetchLeaderboard(undefined, fetchMock)).rejects.toMatchObject({
      code: "LEADERBOARD_UNAVAILABLE",
      status: 503,
    } satisfies Partial<LeaderboardQueryError>);
  });

  it("submitLeaderboardRun posts the shared payload to the backend", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({
        created: true,
        run: {
          runId: "run_123",
          playerId: PLAYER_ID,
          clientRunId: "game-123",
          metrics: {
            money: 1,
            cumulativeRevenue: 2,
            totalServers: 3,
            computeCapacity: 4,
            memoryCapacity: 5,
            storageCapacity: 6,
            gpuCapacity: 7,
          },
          gameMonth: 8,
          submittedAt: "2026-05-18T12:00:00.000Z",
          updatedAt: "2026-05-18T12:00:00.000Z",
        },
      }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );

    const submission = {
      playerId: PLAYER_ID,
      clientRunId: "game-123",
      metrics: {
        money: 1,
        cumulativeRevenue: 2,
        totalServers: 3,
        computeCapacity: 4,
        memoryCapacity: 5,
        storageCapacity: 6,
        gpuCapacity: 7,
      },
      gameMonth: 8,
    };

    const result = await submitLeaderboardRun(submission, fetchMock);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.dctycoon.test/leaderboard/runs",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(submission),
      }),
    );
    expect(result.created).toBe(true);
    expect(result.run.runId).toBe("run_123");
  });

  it("submitLeaderboardRun surfaces structured API errors", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({
        error: {
          code: "INVALID_LEADERBOARD_SUBMISSION",
          message: "metrics.money must be non-negative.",
        },
      }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(submitLeaderboardRun({
      playerId: PLAYER_ID,
      clientRunId: "game-123",
      metrics: {
        money: -1,
        cumulativeRevenue: 2,
        totalServers: 3,
        computeCapacity: 4,
        memoryCapacity: 5,
        storageCapacity: 6,
        gpuCapacity: 7,
      },
      gameMonth: 8,
    }, fetchMock)).rejects.toMatchObject({
      code: "INVALID_LEADERBOARD_SUBMISSION",
      status: 400,
    } satisfies Partial<LeaderboardSubmissionError>);
  });
});
