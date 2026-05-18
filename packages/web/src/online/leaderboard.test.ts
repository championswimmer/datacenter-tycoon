import { beforeEach, describe, expect, it, vi } from "vitest";
import { newGame } from "@datacenter-tycoon/game-logic";
import {
  buildLeaderboardRunSubmission,
  LeaderboardSubmissionError,
  submitLeaderboardRun,
} from "./leaderboard.js";

describe("online leaderboard submission", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.dctycoon.test");
  });

  it("buildLeaderboardRunSubmission uses the shared game-logic summary helper", () => {
    const state = newGame(123, { playerName: "Acme Cloud" });
    state.tick = 3;
    state.player.cash = 1_500_000;

    expect(buildLeaderboardRunSubmission("player_abc", state)).toEqual({
      playerId: "player_abc",
      clientRunId: state.gameId,
      metrics: {
        money: 1_500_000,
        cumulativeRevenue: 0,
        totalServers: 0,
        computeCapacity: 0,
        memoryCapacity: 0,
        storageCapacity: 0,
        gpuCapacity: 0,
      },
      gameMonth: 3,
    });
  });

  it("submitLeaderboardRun posts the shared payload to the backend", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({
        created: true,
        run: {
          runId: "run_123",
          playerId: "player_abc",
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
      playerId: "player_abc",
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
      playerId: "player_abc",
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
