import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import {
  newGame,
  reduce,
  DATACENTER_CATALOG,
} from "@datacenter-tycoon/game-logic";
import type { GameState } from "@datacenter-tycoon/game-logic";
import { createGameStore } from "../../store/gameStore.js";
import { StoreProvider } from "../../store/storeContext.js";
import { RackPicker } from "./RackPicker.js";
import { nextDcId } from "../../store/ids.js";

function Wrapper({
  state = newGame(42),
  onClose = vi.fn(),
  row = 0,
  position = 0,
}: {
  state?: GameState;
  onClose?: () => void;
  row?: number;
  position?: number;
}) {
  const store = createGameStore(state);
  const dc = state.datacenters[0]!;
  return (
    <StoreProvider store={store}>
      <RackPicker
        datacenter={dc}
        row={row}
        position={position}
        onClose={onClose}
      />
    </StoreProvider>
  );
}

function stateWithGarage() {
  const base = newGame(42);
  const dcId = nextDcId();
  const firstRegionId = base.map.regions[0]!.id;
  return reduce(base, {
    type: "BuildDatacenter",
    specId: DATACENTER_CATALOG.garage!.id,
    dcId,
    regionId: firstRegionId,
  });
}

describe("RackPicker", () => {
  it("renders the INSTALL RACK title", () => {
    render(<Wrapper state={stateWithGarage()} />);
    expect(screen.getByText("INSTALL RACK")).toBeTruthy();
  });

  it("shows filter chips for all kinds", () => {
    render(<Wrapper state={stateWithGarage()} />);
    expect(screen.getByText("COMPUTE")).toBeTruthy();
    expect(screen.getByText("MEMORY")).toBeTruthy();
    expect(screen.getByText("STORAGE")).toBeTruthy();
    expect(screen.getByText("GPU")).toBeTruthy();
  });

  it("shows all 16 rack cards when ALL filter is active", () => {
    render(<Wrapper state={stateWithGarage()} />);
    expect(screen.getByText("C0 Compute Rack")).toBeTruthy();
    expect(screen.getByText("G3 GPU Rack")).toBeTruthy();
  });

  it("filters to compute-only when COMPUTE chip is clicked", () => {
    render(<Wrapper state={stateWithGarage()} />);
    fireEvent.click(screen.getByText("COMPUTE"));
    expect(screen.getByText("C0 Compute Rack")).toBeTruthy();
    expect(screen.queryByText("M0 Memory Rack")).toBeNull();
  });

  it("places a rack and closes immediately when an enabled rack card is clicked", () => {
    const onClose = vi.fn();
    const state = stateWithGarage();
    const store = createGameStore(state);
    const dc = state.datacenters[0]!;

    render(
      <StoreProvider store={store}>
        <RackPicker datacenter={dc} row={0} position={0} onClose={onClose} />
      </StoreProvider>,
    );

    expect(screen.queryByText(/INSTALL —/i)).toBeNull();
    fireEvent.click(screen.getByText("C0 Compute Rack"));

    expect(store.getState().datacenters[0]!.placements).toHaveLength(1);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps disabled racks non-interactive while showing feedback", () => {
    const onClose = vi.fn();
    const state = stateWithGarage();
    state.player.cash = 0;
    const store = createGameStore(state);
    const dc = state.datacenters[0]!;

    render(
      <StoreProvider store={store}>
        <RackPicker datacenter={dc} row={0} position={0} onClose={onClose} />
      </StoreProvider>,
    );

    const rackButton = screen.getByRole("button", { name: /C0 Compute Rack/i });
    expect(rackButton.getAttribute("disabled")).not.toBeNull();
    expect(within(rackButton).getByText(/Need \$/i)).toBeTruthy();

    fireEvent.click(rackButton);

    expect(store.getState().datacenters[0]!.placements).toHaveLength(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows footer guidance for direct placement", () => {
    render(<Wrapper state={stateWithGarage()} />);
    expect(screen.getByText(/Click any available rack card to place it immediately/i)).toBeTruthy();
  });

  it("calls onClose when CANCEL is clicked", () => {
    const onClose = vi.fn();
    render(<Wrapper state={stateWithGarage()} onClose={onClose} />);
    fireEvent.click(screen.getByText("CANCEL"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when ✕ is clicked", () => {
    const onClose = vi.fn();
    render(<Wrapper state={stateWithGarage()} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("has role=dialog", () => {
    render(<Wrapper state={stateWithGarage()} />);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("shows the slot position in the header", () => {
    render(<Wrapper state={stateWithGarage()} row={1} position={2} />);
    expect(screen.getByText(/Row B, Slot 3/)).toBeTruthy();
  });
});
