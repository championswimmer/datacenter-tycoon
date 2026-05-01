import { useState } from "react";
import type { DatacenterId, GridPosition, RackPlacementId } from "@datacenter-tycoon/game-logic";
import { useSelector, useGameDispatch } from "../../store/storeContext.js";
import { selectDatacenter, selectActiveContracts } from "../../store/selectors.js";
import { Grid } from "./Grid.js";
import { RackPicker } from "./RackPicker.js";
import styles from "./FloorView.module.css";

interface FloorViewProps {
  dcId: DatacenterId;
}

export function FloorView({ dcId }: FloorViewProps) {
  const dc              = useSelector(s => selectDatacenter(s, dcId));
  const activeContracts = useSelector(selectActiveContracts);
  const dispatch        = useGameDispatch();

  const [pickerSlot, setPickerSlot] = useState<GridPosition | null>(null);

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

  return (
    <div className={styles.floor}>
      <Grid
        datacenter={dc}
        hasActiveContract={hasActiveContract}
        hasFault={hasFault}
        onSlotClick={(row, position) => setPickerSlot({ row, position })}
        onDecommission={handleDecommission}
      />

      {pickerSlot && (
        <RackPicker
          datacenter={dc}
          row={pickerSlot.row}
          position={pickerSlot.position}
          onClose={() => setPickerSlot(null)}
        />
      )}
    </div>
  );
}
