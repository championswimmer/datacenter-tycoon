import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { newGame } from "@datacenter-tycoon/game-logic";
import { createGameStore } from "../../store/gameStore.js";
import { StoreProvider } from "../../store/storeContext.js";
import { TopBar } from "./TopBar.js";

function Wrapper({ children }: { children: React.ReactNode }) {
  const store = createGameStore(newGame(42, { playerName: "Acme Corp" }));
  return <StoreProvider store={store}>{children}</StoreProvider>;
}

describe("TopBar", () => {
  it("renders player name", () => {
    render(
      <Wrapper>
        <TopBar speed={1} onSpeedChange={() => {}} />
      </Wrapper>,
    );
    expect(screen.getByText("Acme Corp")).toBeTruthy();
  });

  it("renders all 4 speed buttons", () => {
    render(
      <Wrapper>
        <TopBar speed={1} onSpeedChange={() => {}} />
      </Wrapper>,
    );
    expect(screen.getByTitle("Pause")).toBeTruthy();
    expect(screen.getByTitle("1× speed")).toBeTruthy();
    expect(screen.getByTitle("2× speed")).toBeTruthy();
    expect(screen.getByTitle("3× speed")).toBeTruthy();
  });

  it("marks the active speed button as pressed", () => {
    render(
      <Wrapper>
        <TopBar speed={2} onSpeedChange={() => {}} />
      </Wrapper>,
    );
    const btn = screen.getByTitle("2× speed");
    expect(btn.getAttribute("aria-pressed")).toBe("true");
  });

  it("renders CASH hudLabel", () => {
    render(
      <Wrapper>
        <TopBar speed={1} onSpeedChange={() => {}} />
      </Wrapper>,
    );
    expect(screen.getByText("CASH")).toBeTruthy();
  });
});
