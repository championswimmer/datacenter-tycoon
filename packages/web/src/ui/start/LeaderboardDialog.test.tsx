import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeaderboardDialog } from "./LeaderboardDialog.js";
import type { LeaderboardListResult } from "../../online/leaderboard.js";

function buildResult(): LeaderboardListResult {
  return {
    metric: "cumulativeRevenue",
    period: "all-time",
    limit: 10,
    entries: [
      {
        rank: 1,
        playerId: "player-1",
        username: "Acme Corp",
        metric: "cumulativeRevenue",
        value: 125000,
        submittedAt: "2026-05-31T10:00:00.000Z",
        gameMonth: 23,
        metrics: {
          money: 40000,
          cumulativeRevenue: 125000,
          totalServers: 32,
          computeCapacity: 2048,
          memoryCapacity: 4096,
          storageCapacity: 1024,
          gpuCapacity: 256,
        },
      },
    ],
  };
}

describe("LeaderboardDialog", () => {
  it("formats played-through duration as years and months", () => {
    render(
      <LeaderboardDialog
        activeMetric="cumulativeRevenue"
        result={buildResult()}
        isLoading={false}
        errorMessage={null}
        onClose={vi.fn()}
        onSelectMetric={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("Played Through")).toBeTruthy();
    expect(screen.getByText("1 year 11 months")).toBeTruthy();
    expect(screen.queryByText("Month 23")).toBeNull();
  });
});
