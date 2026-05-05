import { newGame } from "@datacenter-tycoon/game-logic";
import type { GameState } from "@datacenter-tycoon/game-logic";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createGameStore } from "../../store/gameStore.js";
import { StoreProvider } from "../../store/storeContext.js";
import { Shell } from "./Shell.js";

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });

  window.dispatchEvent(new Event("resize"));
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
});

afterEach(() => {
  act(() => {
    setViewportWidth(1280);
  });
  window.location.hash = "#/";
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
