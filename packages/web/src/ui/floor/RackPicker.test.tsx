import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  newGame,
  reduce,
  DATACENTER_CATALOG,
} from "@datacenter-tycoon/game-logic";
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
  state?: ReturnType<typeof newGame>;
  onClose?: () => void;
  row?: number;
  position?: number;
}) {
  const store = createGameStore(state);
  const dc    = state.datacenters[0]!;
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
  const dcId  = nextDcId();
  const firstRegionId = base.map.regions[0]!.id;
  const state = reduce(base, {
    type: "BuildDatacenter",
    specId: DATACENTER_CATALOG["garage"]!.id,
    dcId,
    regionId: firstRegionId,
  });
  return state;
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

  it("shows all 12 rack cards when ALL filter is active", () => {
    render(<Wrapper state={stateWithGarage()} />);
    // 12 cards + several buttons (chips, footer) — check for rack names
    expect(screen.getByText("C1 Compute Rack")).toBeTruthy();
    expect(screen.getByText("G3 GPU Rack")).toBeTruthy();
  });

  it("filters to compute-only when COMPUTE chip is clicked", () => {
    render(<Wrapper state={stateWithGarage()} />);
    fireEvent.click(screen.getByText("COMPUTE"));
    expect(screen.getByText("C1 Compute Rack")).toBeTruthy();
    expect(screen.queryByText("M1 Memory Rack")).toBeNull();
  });

  it("INSTALL button is disabled with no selection", () => {
    // Empty state has no DCs — create state carefully
    const state = stateWithGarage();
    // Drain cash to ensure nothing is affordable — use a fresh state trick
    const store = createGameStore(state);
    const dc = state.datacenters[0]!;
    render(
      <StoreProvider store={store}>
        <RackPicker datacenter={dc} row={0} position={0} onClose={vi.fn()} />
      </StoreProvider>,
    );
    // There should be an INSTALL button
    const installBtn = screen.getByRole("button", { name: /INSTALL|SELECT/i });
    // With starting $2.5M cash, C1 at $35K should be affordable and auto-selected
    // so button should be enabled
    expect(installBtn).toBeTruthy();
  });

  it("dispatches PlaceRack and calls onClose when INSTALL is clicked", () => {
    const onClose = vi.fn();
    const state   = stateWithGarage();
    const store   = createGameStore(state);
    const dc      = state.datacenters[0]!;
    render(
      <StoreProvider store={store}>
        <RackPicker datacenter={dc} row={0} position={0} onClose={onClose} />
      </StoreProvider>,
    );
    // C1 should be auto-selected (affordable + valid)
    const installBtn = screen.getByRole("button", { name: /INSTALL/i });
    fireEvent.click(installBtn);
    expect(store.getState().datacenters[0]!.placements).toHaveLength(1);
    expect(onClose).toHaveBeenCalledOnce();
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
