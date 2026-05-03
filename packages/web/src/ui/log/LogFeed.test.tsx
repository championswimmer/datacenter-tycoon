import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { newGame, reduce , DEFAULT_REGION_ID } from "@datacenter-tycoon/game-logic";
import { createGameStore } from "../../store/gameStore.js";
import { StoreProvider } from "../../store/storeContext.js";
import { LogFeed } from "./LogFeed.js";

function Wrapper({ state = newGame(42) }: { state?: ReturnType<typeof newGame> }) {
  const store = createGameStore(state);
  return <StoreProvider store={store}><LogFeed /></StoreProvider>;
}

describe("LogFeed", () => {
  it("shows 'Awaiting events…' on a fresh game", () => {
    render(<Wrapper />);
    expect(screen.getByText("Awaiting events…")).toBeTruthy();
  });

  it("shows a CAPEX entry after building a datacenter", async () => {
    const { DATACENTER_CATALOG } = await import("@datacenter-tycoon/game-logic");
    const { nextDcId } = await import("../../store/ids.js");
    const state = reduce(newGame(42), {
      type: "BuildDatacenter",
      specId: DATACENTER_CATALOG["garage"]!.id,
      dcId: nextDcId(),
		regionId: DEFAULT_REGION_ID,
    });
    render(<Wrapper state={state} />);
    expect(screen.getByText("CAPEX")).toBeTruthy();
  });

  it("has role=log for accessibility", () => {
    render(<Wrapper />);
    expect(screen.getByRole("log")).toBeTruthy();
  });
});
