import { DATACENTER_CATALOG, newGame, reduce } from "@datacenter-tycoon/game-logic";
import type { GameState } from "@datacenter-tycoon/game-logic";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createGameStore } from "../../store/gameStore.js";
import { nextDcId } from "../../store/ids.js";
import { StoreProvider } from "../../store/storeContext.js";
import { markTutorialSeen, resetTutorialSeen } from "../../store/tutorialPersist.js";
import { Shell } from "./Shell.js";

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });

  window.dispatchEvent(new Event("resize"));
}

function stateWithGarageDatacenter(): GameState {
  const base = newGame(42, { playerName: "Acme Corp" });
  return reduce(base, {
    type: "BuildDatacenter",
    specId: DATACENTER_CATALOG.garage!.id,
    dcId: nextDcId(),
    regionId: base.map.regions[0]!.id,
  });
}

function Wrapper({
  children,
  state = newGame(42, { playerName: "Acme Corp" }),
}: {
  children: React.ReactNode;
  state?: GameState;
}) {
  const store = createGameStore(state);
  return <StoreProvider store={store}>{children}</StoreProvider>;
}

beforeEach(() => {
  window.location.hash = "#/";
  resetTutorialSeen();
});

afterEach(() => {
  act(() => {
    setViewportWidth(1280);
  });
  window.location.hash = "#/";
  resetTutorialSeen();
});

describe("Shell tutorial flow", () => {
  it("auto-opens the tutorial when a fresh session starts", () => {
    render(
      <Wrapper>
        <Shell shouldAutoOpenTutorial />
      </Wrapper>,
    );

    expect(screen.getByRole("dialog", { name: "HOW TO PLAY" })).toBeTruthy();
  });

  it("does not auto-open the tutorial when the session start is not fresh", () => {
    render(
      <Wrapper>
        <Shell shouldAutoOpenTutorial={false} />
      </Wrapper>,
    );

    expect(screen.queryByRole("dialog", { name: "HOW TO PLAY" })).toBeNull();
  });

  it("does not auto-open the tutorial when it was already seen", () => {
    markTutorialSeen();

    render(
      <Wrapper>
        <Shell shouldAutoOpenTutorial />
      </Wrapper>,
    );

    expect(screen.queryByRole("dialog", { name: "HOW TO PLAY" })).toBeNull();
  });
});

describe("Shell route recovery", () => {
  it("renders the finances screen for the finances route", async () => {
    window.location.hash = "#/finances";

    render(
      <Wrapper state={stateWithGarageDatacenter()}>
        <Shell />
      </Wrapper>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole("heading", { name: "FINANCES" })).toBeTruthy();
  });

  it("redirects a stale datacenter route to the first available datacenter", async () => {
    const state = stateWithGarageDatacenter();
    window.location.hash = "#/dc/missing-dc/floor";

    render(
      <Wrapper state={state}>
        <Shell />
      </Wrapper>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(window.location.hash).toBe(`#/dc/${state.datacenters[0]!.id}/floor`);
  });

  it("returns to home when the route points at a datacenter but the session has none", async () => {
    window.location.hash = "#/dc/missing-dc/floor";

    render(
      <Wrapper>
        <Shell />
      </Wrapper>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(window.location.hash).toBe("#/");
    expect(screen.getByText("NO FACILITIES ONLINE")).toBeTruthy();
  });
});

describe("Shell mobile drawers", () => {
  it("keeps both rails visible on desktop without mobile triggers", () => {
    act(() => {
      setViewportWidth(1280);
    });

    render(
      <Wrapper>
        <Shell />
      </Wrapper>,
    );

    expect(screen.getByLabelText("Datacenter navigation")).toBeTruthy();
    expect(screen.getByLabelText("Event log")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Toggle datacenters drawer" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Toggle event log drawer" })).toBeNull();
  });

  it("toggles the datacenter drawer from the phone trigger", () => {
    act(() => {
      setViewportWidth(390);
    });

    render(
      <Wrapper>
        <Shell />
      </Wrapper>,
    );

    const trigger = screen.getByRole("button", { name: "Toggle datacenters drawer" });
    trigger.focus();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByLabelText("Datacenter navigation")).toBeNull();

    fireEvent.click(trigger);

    expect(screen.getByLabelText("Datacenter navigation")).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(screen.getByLabelText("Close mobile drawer"));

    expect(screen.queryByLabelText("Datacenter navigation")).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });

  it("opens the event log drawer from the phone trigger", () => {
    act(() => {
      setViewportWidth(390);
    });

    render(
      <Wrapper>
        <Shell />
      </Wrapper>,
    );

    const trigger = screen.getByRole("button", { name: "Toggle event log drawer" });
    expect(screen.queryByLabelText("Event log")).toBeNull();

    fireEvent.click(trigger);

    expect(screen.getByLabelText("Event log")).toBeTruthy();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });
});
