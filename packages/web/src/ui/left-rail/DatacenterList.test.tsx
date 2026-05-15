import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { newGame, reduce, DATACENTER_CATALOG } from "@datacenter-tycoon/game-logic";
import { createGameStore } from "../../store/gameStore.js";
import { StoreProvider } from "../../store/storeContext.js";
import { DatacenterList } from "./DatacenterList.js";
import { nextDcId } from "../../store/ids.js";

function Wrapper({ children, state = newGame(42) }: {
  children: React.ReactNode;
  state?: ReturnType<typeof newGame>;
}) {
  const store = createGameStore(state);
  return <StoreProvider store={store}>{children}</StoreProvider>;
}

describe("DatacenterList", () => {
  it("shows empty message when no DCs exist", () => {
    render(
      <Wrapper>
        <DatacenterList currentRoute={{ view: "home" }} />
      </Wrapper>,
    );
    expect(screen.getByText("No facilities online")).toBeTruthy();
  });

  it("shows DC name after building one", () => {
    const base = newGame(42);
    const dcId = nextDcId();
    const firstRegionId = base.map.regions[0]!.id;
    const state = reduce(base, {
      type: "BuildDatacenter",
      specId: DATACENTER_CATALOG["garage"]!.id,
      dcId,
      regionId: firstRegionId,
    });
    render(
      <Wrapper state={state}>
        <DatacenterList currentRoute={{ view: "home" }} />
      </Wrapper>,
    );
    expect(screen.getByText("Garage Datacenter")).toBeTruthy();
  });

  it("shows fabric readiness and effective network info after upgrades", () => {
    const base = newGame(42, { startingCash: 4_000_000 });
    const dcId = nextDcId();
    const firstRegionId = base.map.regions[0]!.id;
    let state = reduce(base, {
      type: "BuildDatacenter",
      specId: DATACENTER_CATALOG["garage"]!.id,
      dcId,
      regionId: firstRegionId,
    });
    state = reduce(state, {
      type: "UpgradeDatacenter",
      dcId,
      trackId: "networkType",
      targetNodeId: "cat8",
    });
    state = reduce(state, {
      type: "UpgradeDatacenter",
      dcId,
      trackId: "networkType",
      targetNodeId: "fiber",
    });
    render(
      <Wrapper state={state}>
        <DatacenterList currentRoute={{ view: "home" }} />
      </Wrapper>,
    );
    expect(screen.getByText(/FABRIC READY/)).toBeTruthy();
    expect(screen.getByText("FIBER")).toBeTruthy();
  });

  it("renders the New Datacenter button", () => {
    render(
      <Wrapper>
        <DatacenterList currentRoute={{ view: "home" }} />
      </Wrapper>,
    );
    expect(screen.getByTitle("Build a new datacenter")).toBeTruthy();
  });

  it("always renders a contracts button that navigates to contracts", () => {
    render(
      <Wrapper>
        <DatacenterList currentRoute={{ view: "home" }} />
      </Wrapper>,
    );
    const button = screen.getByTitle("Open contracts market");
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(window.location.hash).toBe("#/contracts");
  });
});
