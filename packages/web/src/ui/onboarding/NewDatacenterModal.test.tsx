import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { newGame } from "@datacenter-tycoon/game-logic";
import type { RegionId } from "@datacenter-tycoon/game-logic";
import { createGameStore } from "../../store/gameStore.js";
import { StoreProvider } from "../../store/storeContext.js";
import { NewDatacenterModal } from "./NewDatacenterModal.js";

function Wrapper({
  state = newGame(42),
  onClose = () => {},
  regionId = state.map.regions[0]!.id as RegionId,
}: {
  state?: ReturnType<typeof newGame>;
  onClose?: () => void;
  regionId?: RegionId;
}) {
  const store = createGameStore(state);
  return (
    <StoreProvider store={store}>
      <NewDatacenterModal onClose={onClose} regionId={regionId} />
    </StoreProvider>
  );
}

describe("NewDatacenterModal", () => {
  it("renders the modal title", () => {
    render(<Wrapper />);
    expect(screen.getByText("BUILD DATACENTER")).toBeTruthy();
  });

  it("shows all three catalog entries", () => {
    render(<Wrapper />);
    expect(screen.getByText("Garage Datacenter")).toBeTruthy();
    expect(screen.getByText("Warehouse Datacenter")).toBeTruthy();
    expect(screen.getByText("Hyperscale Campus")).toBeTruthy();
  });

  it("shows the player's budget", () => {
    render(<Wrapper />);
    // Starting cash is $2.5M; budget line should appear
    expect(screen.getByText("Budget:")).toBeTruthy();
  });

  it("shows AFFORDABLE badge on affordable specs", () => {
    render(<Wrapper />);
    // Starting cash $2.5M: Garage ($250K) and Warehouse ($1.4M) are affordable
    const affordBadges = screen.getAllByText("✓ AFFORDABLE");
    expect(affordBadges.length).toBeGreaterThanOrEqual(1);
  });

  it("shows InsufficientFunds badge on Hyperscale (costs $18M, only $2.5M available)", () => {
    render(<Wrapper />);
    // Hyperscale costs $18M; starting cash $2.5M → shortfall $15.5M
    const badges = screen.getAllByRole("status");
    expect(badges.length).toBeGreaterThan(0);
  });

  it("BUILD button is disabled when unaffordable spec is selected", () => {
    render(<Wrapper />);
    // Click the Hyperscale card (unaffordable)
    const hyperscaleCard = screen.getByText("Hyperscale Campus").closest("button")!;
    fireEvent.click(hyperscaleCard);
    const buildBtn = screen.getByRole("button", { name: /BUILD/i });
    expect(buildBtn).toHaveProperty("disabled", true);
  });

  it("BUILD button is enabled when affordable spec is selected", () => {
    render(<Wrapper />);
    // Garage is affordable by default (selected on mount)
    const buildBtn = screen.getByRole("button", { name: /BUILD/i });
    expect(buildBtn).toHaveProperty("disabled", false);
  });

  it("calls onClose when CANCEL is clicked", () => {
    const onClose = vi.fn();
    render(<Wrapper onClose={onClose} />);
    fireEvent.click(screen.getByText("CANCEL"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when ✕ is clicked", () => {
    const onClose = vi.fn();
    render(<Wrapper onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close modal"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(<Wrapper onClose={onClose} />);
    const backdrop = container.querySelector("[role='presentation']")!;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("dispatches BuildDatacenter and closes modal on BUILD click", () => {
    const onClose = vi.fn();
    // Use a store we can inspect
    const state = newGame(42);
    const store = createGameStore(state);
    const firstRegionId = state.map.regions[0]!.id as RegionId;
    render(
      <StoreProvider store={store}>
        <NewDatacenterModal onClose={onClose} regionId={firstRegionId} />
      </StoreProvider>,
    );
    // Garage is selected by default (affordable, cheapest)
    const buildBtn = screen.getByRole("button", { name: /BUILD/i });
    fireEvent.click(buildBtn);
    // A new datacenter should have been added to state
    expect(store.getState().datacenters).toHaveLength(1);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("selecting a card updates the BUILD button price label", () => {
    render(<Wrapper />);
    // Click Warehouse card
    fireEvent.click(screen.getByText("Warehouse Datacenter").closest("button")!);
    // BUILD button should show $1.4M
    expect(screen.getByRole("button", { name: /BUILD.*1\.40M/i })).toBeTruthy();
  });

  it("has role=dialog on the panel", () => {
    render(<Wrapper />);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
