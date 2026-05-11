import { useState } from "react";
import type { DatacenterId, GridPosition, RackPlacementId } from "@datacenter-tycoon/game-logic";
import { useSelector, useGameDispatch } from "../../store/storeContext.js";
import {
  selectActiveContracts,
  selectDatacenter,
  selectDatacenterRackActivityViews,
  selectDatacenterRackMaintenanceViews,
} from "../../store/selectors.js";
import { Grid } from "./Grid.js";
import { RackPicker } from "./RackPicker.js";
import { MoveRackModal } from "./MoveRackModal.js";
import styles from "./FloorView.module.css";

interface FloorViewProps {
  dcId: DatacenterId;
}

export function FloorView({ dcId }: FloorViewProps) {
  const datacenter = useSelector((state) => selectDatacenter(state, dcId));
  const activeContracts = useSelector(selectActiveContracts);
  const rackMaintenanceViews = useSelector((state) => selectDatacenterRackMaintenanceViews(state, dcId));
  const rackActivityViews = useSelector((state) => selectDatacenterRackActivityViews(state, dcId));
  const dispatch = useGameDispatch();

  const [pickerSlot, setPickerSlot] = useState<GridPosition | null>(null);
  const [movePlacementId, setMovePlacementId] = useState<RackPlacementId | null>(null);

  if (!datacenter) return null;

  const datacenterContracts = activeContracts.filter((contract) => contract.assignedDcId === datacenter.id);
  const hasActiveContract = datacenterContracts.some((contract) => contract.lifecycleState === "serving");
  const hasFault = datacenterContracts.some((contract) => contract.lifecycleState === "breached");

  const handleDecommission = (placementId: RackPlacementId) => {
    dispatch({ type: "RemoveRack", dcId: datacenter.id, placementId });
  };
  const handleMove = (placementId: RackPlacementId) => {
    setMovePlacementId(placementId);
  };
  const rackMaintenanceByPlacementId = new Map(
    rackMaintenanceViews.map((view) => [view.placementId, view]),
  );
  const rackActivityByPlacementId = new Map(
    rackActivityViews.map((view) => [view.placementId, view]),
  );

  return (
    <div className={styles.floor}>
      <Grid
        datacenter={datacenter}
        rackMaintenanceByPlacementId={rackMaintenanceByPlacementId}
        rackActivityByPlacementId={rackActivityByPlacementId}
        hasActiveContract={hasActiveContract}
        hasFault={hasFault}
        onSlotClick={(row, position) => setPickerSlot({ row, position })}
        onDecommission={handleDecommission}
        onMove={handleMove}
      />

      {pickerSlot && (
        <RackPicker
          datacenter={datacenter}
          row={pickerSlot.row}
          position={pickerSlot.position}
          onClose={() => setPickerSlot(null)}
        />
      )}

      {movePlacementId && (
        <MoveRackModal
          sourceDcId={dcId}
          placementId={movePlacementId}
          onClose={() => setMovePlacementId(null)}
        />
      )}
    </div>
  );
}
