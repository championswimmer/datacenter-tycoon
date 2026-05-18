import { useCallback, useMemo, useState } from "react";
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

  const datacenterContracts = useMemo(
    () => activeContracts.filter((contract) => contract.assignedDcId === datacenter.id),
    [activeContracts, datacenter.id],
  );
  const hasActiveContract = useMemo(
    () => datacenterContracts.some((contract) => contract.lifecycleState === "serving"),
    [datacenterContracts],
  );
  const hasFault = useMemo(
    () => datacenterContracts.some((contract) => contract.lifecycleState === "breached"),
    [datacenterContracts],
  );

  const handleDecommission = useCallback((placementId: RackPlacementId) => {
    dispatch({ type: "RemoveRack", dcId: datacenter.id, placementId });
  }, [datacenter.id, dispatch]);
  const handleMove = useCallback((placementId: RackPlacementId) => {
    setMovePlacementId(placementId);
  }, []);
  const handleSlotClick = useCallback((row: number, position: number) => {
    setPickerSlot({ row, position });
  }, []);
  const rackMaintenanceByPlacementId = useMemo(
    () => new Map(rackMaintenanceViews.map((view) => [view.placementId, view] as const)),
    [rackMaintenanceViews],
  );
  const rackActivityByPlacementId = useMemo(
    () => new Map(rackActivityViews.map((view) => [view.placementId, view] as const)),
    [rackActivityViews],
  );

  return (
    <div className={styles.floor}>
      <Grid
        datacenter={datacenter}
        rackMaintenanceByPlacementId={rackMaintenanceByPlacementId}
        rackActivityByPlacementId={rackActivityByPlacementId}
        hasActiveContract={hasActiveContract}
        hasFault={hasFault}
        onSlotClick={handleSlotClick}
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
