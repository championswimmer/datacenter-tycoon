import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  newGame,
  type DatacenterId,
  type DatacenterSpecId,
} from "@datacenter-tycoon/game-logic";
import { createGameStore, StoreProvider } from "@datacenter-tycoon/web";
import { IsoShell } from "./IsoShell.js";

describe("IsoShell integration", () => {
  it("supports switching city/facility 3D views, placing & bulldozing racks, switching overlays, and opening drawers", async () => {
    const user = userEvent.setup();
    const initial = newGame(2025, { playerName: "Skyline Integration", difficulty: "easy" });
    const store = createGameStore(initial);
    const regionId = initial.map.regions[0]!.id;
    const dcId = "dc-shell-1" as DatacenterId;

    store.dispatch({
      type: "BuildDatacenter",
      specId: "garage" as DatacenterSpecId,
      dcId,
      regionId,
    });

    render(
      <StoreProvider store={store}>
        <IsoShell shouldAutoOpenTutorial={false} />
      </StoreProvider>,
    );

    // Starts in Facility 3D mode when a datacenter already exists
    expect(screen.getByLabelText(/Isometric 3D Datacenter Cutaway Canvas/i)).toBeTruthy();

    // Select Compute brush from SkylinesBuildDock and place C0 on Row 1 Bay 1
    await user.click(screen.getByRole("button", { name: /^Compute$/i }));
    await user.click(screen.getByRole("button", { name: /Empty Slot Row 1 Bay 1/i }));
    expect(store.getState().datacenters[0]!.placements).toHaveLength(1);

    // Switch to Thermal Info View
    await user.click(screen.getByRole("radio", { name: /Thermal/i }));
    expect(screen.getByRole("radio", { name: /Thermal/i }).getAttribute("aria-checked")).toBe("true");

    // Rotate camera CW
    await user.click(screen.getByRole("button", { name: /E ⟳/i }));
    expect(screen.getByText(/CAMERA · NE/i)).toBeTruthy();

    // Open Contracts drawer and close it
    await user.click(screen.getByRole("button", { name: /Contracts/i }));
    expect(screen.getByRole("dialog", { name: /Contracts Market/i })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Close Drawer/i }));
    expect(screen.queryByRole("dialog", { name: /Contracts Market/i })).toBeNull();

    // Switch back to City Skyline view and re-enter Facility via canvas overlay
    await user.click(screen.getByRole("button", { name: /🏙 City Skyline/i }));
    expect(screen.getByLabelText(/Isometric 3D City District Canvas/i)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Enter Garage Datacenter 3D Cutaway/i }));
    expect(screen.getByLabelText(/Isometric 3D Datacenter Cutaway Canvas/i)).toBeTruthy();

    // Bulldoze the placed rack
    await user.click(screen.getByRole("button", { name: /Bulldoze/i }));
    await user.click(screen.getByRole("button", { name: /Rack C0 at Row 1 Bay 1/i }));
    expect(store.getState().datacenters[0]!.placements).toHaveLength(0);
  });
});
