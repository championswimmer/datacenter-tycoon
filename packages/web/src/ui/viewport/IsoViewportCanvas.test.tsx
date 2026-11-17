import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  newGame,
  type DatacenterId,
  type DatacenterSpecId,
  type RackPlacementId,
  type RackSpecId,
} from "@datacenter-tycoon/game-logic";
import { createGameStore } from "../../store/gameStore.js";
import { StoreProvider } from "../../store/storeContext.js";
import { createCameraState } from "../../engine/camera.js";
import { IsoViewportCanvas } from "./IsoViewportCanvas.js";

describe("IsoViewportCanvas", () => {
  it("renders city district scene and triggers facility entry & vacant-lot building", async () => {
    const user = userEvent.setup();
    const initial = newGame(15, { playerName: "Canvas Ops", difficulty: "easy" });
    const store = createGameStore(initial);
    const regionId = initial.map.regions[0]!.id;
    const dcId = "dc-city-canvas" as DatacenterId;

    store.dispatch({
      type: "BuildDatacenter",
      specId: "garage" as DatacenterSpecId,
      dcId,
      regionId,
    });

    const onSelect = vi.fn();
    const onEnterFacility = vi.fn();
    const onOpenBuildDcModal = vi.fn();

    render(
      <StoreProvider store={store}>
        <IsoViewportCanvas
          viewMode="city"
          activeRegionId={regionId}
          activeDcId={dcId}
          camera={createCameraState(12, 12)}
          onCameraChange={vi.fn()}
          overlayMode="standard"
          buildTool={{ mode: "select" }}
          selection={{ kind: "none" }}
          onSelect={onSelect}
          onEnterFacility={onEnterFacility}
          onOpenBuildDcModal={onOpenBuildDcModal}
        />
      </StoreProvider>,
    );

    expect(screen.getByLabelText(/Isometric 3D City District Canvas/i)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Enter Garage Datacenter 3D Cutaway/i }));
    expect(onEnterFacility).toHaveBeenCalledWith(dcId, regionId);

    await user.click(screen.getByRole("button", { name: /Build Datacenter on Lot 1/i }));
    expect(onOpenBuildDcModal).toHaveBeenCalledWith(regionId);
  });

  it("places a rack onto an empty 3D slot and bulldozes an existing rack", async () => {
    const user = userEvent.setup();
    const initial = newGame(16, { playerName: "Floor Ops", difficulty: "easy" });
    const store = createGameStore(initial);
    const regionId = initial.map.regions[0]!.id;
    const dcId = "dc-floor-canvas" as DatacenterId;

    store.dispatch({
      type: "BuildDatacenter",
      specId: "garage" as DatacenterSpecId,
      dcId,
      regionId,
    });

    const onSelect = vi.fn();
    const { rerender } = render(
      <StoreProvider store={store}>
        <IsoViewportCanvas
          viewMode="facility"
          activeRegionId={regionId}
          activeDcId={dcId}
          camera={createCameraState(4, 2)}
          onCameraChange={vi.fn()}
          overlayMode="standard"
          buildTool={{ mode: "place_rack", specId: "C0" as RackSpecId }}
          selection={{ kind: "none" }}
          onSelect={onSelect}
          onEnterFacility={vi.fn()}
          onOpenBuildDcModal={vi.fn()}
        />
      </StoreProvider>,
    );

    // Install C0 into Row 1 Bay 1
    await user.click(screen.getByRole("button", { name: /Empty Slot Row 1 Bay 1/i }));
    expect(store.getState().datacenters[0]!.placements).toHaveLength(1);
    const placedId = store.getState().datacenters[0]!.placements[0]!.id as RackPlacementId;
    expect(onSelect).toHaveBeenCalledWith({
      kind: "rack",
      dcId,
      placementId: placedId,
      row: 0,
      position: 0,
    });

    // Switch to bulldozer tool and decommission that rack
    rerender(
      <StoreProvider store={store}>
        <IsoViewportCanvas
          viewMode="facility"
          activeRegionId={regionId}
          activeDcId={dcId}
          camera={createCameraState(4, 2)}
          onCameraChange={vi.fn()}
          overlayMode="power"
          buildTool={{ mode: "bulldozer" }}
          selection={{ kind: "none" }}
          onSelect={onSelect}
          onEnterFacility={vi.fn()}
          onOpenBuildDcModal={vi.fn()}
        />
      </StoreProvider>,
    );

    await user.click(screen.getByRole("button", { name: /Rack C0 at Row 1 Bay 1/i }));
    expect(store.getState().datacenters[0]!.placements).toHaveLength(0);
  });
});
