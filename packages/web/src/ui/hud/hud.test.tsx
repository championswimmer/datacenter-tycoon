import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  newGame,
  type DatacenterId,
  type DatacenterSpecId,
  type RackSpecId,
} from "@datacenter-tycoon/game-logic";
import { createGameStore, StoreProvider } from "@datacenter-tycoon/web";
import { TopHudBar } from "./TopHudBar.js";
import { InfoOverlayDock } from "./InfoOverlayDock.js";
import { BuildDock } from "./BuildDock.js";
import { InspectorPanel } from "./InspectorPanel.js";

function createTestStoreWithDc() {
  const state = newGame(42, { playerName: "Metro Ops", difficulty: "easy" });
  const store = createGameStore(state);
  const regionId = state.map.regions[0]!.id;
  const dcId = "dc-test-1" as DatacenterId;
  store.dispatch({
    type: "BuildDatacenter",
    specId: "garage" as DatacenterSpecId,
    dcId,
    regionId,
  });
  expect(store.getState().datacenters).toHaveLength(1);
  return { store, regionId, dcId };
}

describe("3D HUD components", () => {
  it("renders formatted calendar date, speed buttons, and mode switcher in TopHudBar", async () => {
    const user = userEvent.setup();
    const { store, regionId, dcId } = createTestStoreWithDc();
    const onSpeedChange = vi.fn();
    const onEnterCity = vi.fn();
    const onEnterFacility = vi.fn();

    render(
      <StoreProvider store={store}>
        <TopHudBar
          viewMode="facility"
          activeRegionId={regionId}
          activeDcId={dcId}
          speed={1}
          onSpeedChange={onSpeedChange}
          onEnterCity={onEnterCity}
          onSelectRegion={vi.fn()}
          onEnterFacility={onEnterFacility}
          onOpenTutorial={vi.fn()}
          onOpenAudioSettings={vi.fn()}
          onOpenResetModal={vi.fn()}
        />
      </StoreProvider>,
    );

    expect(screen.getByText("Metro Ops")).toBeTruthy();
    expect(screen.queryByText(/Tick/i)).toBeNull();
    expect(screen.getByText(/Jan/i)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /3x/i }));
    expect(onSpeedChange).toHaveBeenCalledWith(3);

    await user.click(screen.getByRole("button", { name: /Region View/i }));
    expect(onEnterCity).toHaveBeenCalledTimes(1);
  });

  it("handles info overlays and camera rotation buttons in InfoOverlayDock", async () => {
    const user = userEvent.setup();
    const onSelectOverlay = vi.fn();
    const onRotateCW = vi.fn();
    const onToggleCutaway = vi.fn();

    render(
      <InfoOverlayDock
        overlayMode="standard"
        rotation={0}
        zoom={1}
        cutaway={true}
        viewMode="facility"
        onSelectOverlay={onSelectOverlay}
        onRotateCCW={vi.fn()}
        onRotateCW={onRotateCW}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onFitView={vi.fn()}
        onToggleCutaway={onToggleCutaway}
      />,
    );

    await user.click(screen.getByRole("radio", { name: /Thermal/i }));
    expect(onSelectOverlay).toHaveBeenCalledWith("thermal");

    await user.click(screen.getByRole("button", { name: /E ⟳/i }));
    expect(onRotateCW).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /Walls: Cutaway/i }));
    expect(onToggleCutaway).toHaveBeenCalledTimes(1);
  });

  it("selects rack brushes and management drawers in BuildDock", async () => {
    const user = userEvent.setup();
    const state = newGame(42, { playerName: "Metro Ops", difficulty: "easy" });
    const store = createGameStore(state);
    const onSelectTool = vi.fn();
    const onToggleDrawer = vi.fn();

    render(
      <StoreProvider store={store}>
        <BuildDock
          viewMode="facility"
          buildTool={{ mode: "select" }}
          activeDrawer="none"
          onSelectTool={onSelectTool}
          onToggleDrawer={onToggleDrawer}
          onOpenBuildDcModal={vi.fn()}
        />
      </StoreProvider>,
    );

    await user.click(screen.getByRole("button", { name: /Compute/i }));
    expect(onSelectTool).toHaveBeenCalledWith({
      mode: "place_rack",
      specId: "C0" as RackSpecId,
    });

    await user.click(screen.getByRole("button", { name: /Contracts/i }));
    expect(onToggleDrawer).toHaveBeenCalledWith("contracts");
  });

  it("inspects datacenter and empty floor slot in InspectorPanel", async () => {
    const user = userEvent.setup();
    const { store, regionId, dcId } = createTestStoreWithDc();
    const onOpenRackPicker = vi.fn();

    render(
      <StoreProvider store={store}>
        <InspectorPanel
          selection={{ kind: "slot", dcId, row: 0, position: 1 }}
          activeRegionId={regionId}
          activeDcId={dcId}
          buildTool={{ mode: "select" }}
          onEnterFacility={vi.fn()}
          onEnterCity={vi.fn()}
          onOpenRackPicker={onOpenRackPicker}
          onOpenMoveRackModal={vi.fn()}
          onOpenUpgrades={vi.fn()}
          onOpenBuildDcModal={vi.fn()}
          onClearSelection={vi.fn()}
        />
      </StoreProvider>,
    );

    expect(screen.getByText(/Empty Mounting Bay/i)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Browse Rack Catalog/i }));
    expect(onOpenRackPicker).toHaveBeenCalledWith(dcId, 0, 1);
  });
});
