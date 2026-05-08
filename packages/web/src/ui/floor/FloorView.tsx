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
  const dc              = useSelector(s => selectDatacenter(s, dcId));
  const activeContracts = useSelector(selectActiveContracts);
  const rackMaintenanceViews = useSelector(s => selectDatacenterRackMaintenanceViews(s, dcId));
  const rackActivityViews = useSelector(s => selectDatacenterRackActivityViews(s, dcId));
  const dispatch        = useGameDispatch();

  const [pickerSlot, setPickerSlot] = useState<GridPosition | null>(null);
  const [movePlacementId, setMovePlacementId] = useState<RackPlacementId | null>(null);

  if (!dc) return null;

  const hasActiveContract = activeContracts.some(
    c => c.assignedDcId === dc.id && c.status === "active",
  );
  const hasFault = activeContracts.some(
    c => c.assignedDcId === dc.id && c.status === "breached",
  );

  const handleDecommission = (placementId: RackPlacementId) => {
    dispatch({ type: "RemoveRack", dcId: dc.id, placementId });
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
        datacenter={dc}
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
          datacenter={dc}
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
