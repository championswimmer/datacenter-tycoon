import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchLeaderboard, LeaderboardQueryError, LeaderboardSubmissionError, submitLeaderboardRun } from "./leaderboard.js";
import { buildVerifiedCheckpointSubmission, createInitialVerifiedRunState } from "./verified-run.js";

const PLAYER_ID = "8d8f3b8f-0d43-4d7a-a2d0-8c2b6fd0d927";

describe("online leaderboard", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.dctycoon.test");
  });

  it("buildVerifiedCheckpointSubmission emits action-only payloads", async () => {
    const { newGame, reduce } = await import("@datacenter-tycoon/game-logic");
    const state = reduce(newGame(123, { playerName: "Acme Cloud" }), { type: "Tick" });
    const verification = {
      ...createInitialVerifiedRunState(state, { onlineEligible: true }),
      pendingActions: [{ type: "Tick" as const }],
    };

    expect(buildVerifiedCheckpointSubmission(PLAYER_ID, verification)).toEqual({
      playerId: PLAYER_ID,
      clientRunId: state.gameId,
      genesis: {
        seed: state.seed,
        difficulty: state.difficulty,
        rulesetId: "leaderboard-ruleset-v1",
      },
      parentHeadHash: null,
      actions: [{ type: "Tick" }],
    });
  });

  it("fetchLeaderboard requests the revenue leaderboard by default", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({
        metric: "cumulativeRevenue",
        period: "all-time",
        limit: 10,
        visibility: "all",
        entries: [
          {
            rank: 1,
            playerId: PLAYER_ID,
            username: "Acme Cloud",
            metric: "cumulativeRevenue",
            value: 300_000,
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
      "https://api.dctycoon.test/leaderboard?metric=cumulativeRevenue&period=all-time&limit=10&visibility=all",
    );
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.username).toBe("Acme Cloud");
  });

  it("fetchLeaderboard accepts explicit metric queries for leaderboard tabs", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({
        metric: "totalServers",
        period: "all-time",
        limit: 5,
        visibility: "verified",
        entries: [],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await fetchLeaderboard({
      metric: "totalServers",
      limit: 5,
      visibility: "verified",
    }, fetchMock);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.dctycoon.test/leaderboard?metric=totalServers&period=all-time&limit=5&visibility=verified",
    );
    expect(result.metric).toBe("totalServers");
    expect(result.limit).toBe(5);
    expect(result.visibility).toBe("verified");
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
        rootHash: "a".repeat(64),
        headHash: "b".repeat(64),
        gameMonth: 8,
        metrics: {
          money: 1,
          cumulativeRevenue: 2,
          totalServers: 3,
          computeCapacity: 4,
          memoryCapacity: 5,
          storageCapacity: 6,
          gpuCapacity: 7,
        },
      }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );

    const submission = {
      playerId: PLAYER_ID,
      clientRunId: "game-123",
      genesis: {
        seed: 42,
        difficulty: "easy" as const,
        rulesetId: "leaderboard-ruleset-v1",
      },
      parentHeadHash: null,
      actions: [{ type: "Tick" as const }],
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
    expect(result.headHash).toBe("b".repeat(64));
  });

  it("submitLeaderboardRun surfaces structured API errors", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({
        error: {
          code: "INVALID_VERIFIED_RUN",
          message: "actions may contain at most 512 entries.",
        },
      }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(submitLeaderboardRun({
      playerId: PLAYER_ID,
      clientRunId: "game-123",
      genesis: {
        seed: 42,
        difficulty: "easy",
        rulesetId: "leaderboard-ruleset-v1",
      },
      parentHeadHash: null,
      actions: [{ type: "Tick" }],
    }, fetchMock)).rejects.toMatchObject({
      code: "INVALID_VERIFIED_RUN",
      status: 400,
    } satisfies Partial<LeaderboardSubmissionError>);
  });
});
