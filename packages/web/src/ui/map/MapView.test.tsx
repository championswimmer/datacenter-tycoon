import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { newGame } from "@datacenter-tycoon/game-logic";
import { createGameStore } from "../../store/gameStore.js";
import { StoreProvider } from "../../store/storeContext.js";
import { MapView } from "./MapView.js";

function Wrapper({ state = newGame(42) }: { state?: ReturnType<typeof newGame> }) {
  const store = createGameStore(state);
  return (
    <StoreProvider store={store}>
      <MapView />
    </StoreProvider>
  );
}

describe("MapView", () => {
  it("renders both the world map and the sortable region table", () => {
    render(<Wrapper />);

    expect(screen.getByText("GLOBAL FOOTPRINT")).toBeTruthy();
    expect(screen.getByText("REGION ECONOMICS")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Select region marker IAD — Ashburn, US East" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Select region row IAD — Ashburn, US East" }),
    ).toBeTruthy();
  });

  it("keeps marker, table row, and region panel selection in sync", () => {
    render(<Wrapper />);

    fireEvent.click(
      screen.getByRole("button", { name: "Select region row FRA — Frankfurt, EU Central" }),
    );

    expect(
      screen.getByRole("button", { name: "Select region marker FRA — Frankfurt, EU Central" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: "Select region row FRA — Frankfurt, EU Central" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByRole("heading", { name: "EU Central" })).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Select region marker DXB — Dubai, ME Central" }),
    );

    expect(
      screen.getByRole("button", { name: "Select region row DXB — Dubai, ME Central" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByRole("heading", { name: "ME Central" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "BUILD HERE" })).toBeTruthy();
  });
});
