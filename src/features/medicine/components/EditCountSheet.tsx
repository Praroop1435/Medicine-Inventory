import { useState } from 'react';
import { Button, ButtonRow, ConfirmDialog, Sheet, Stepper } from '@/ui';

/** Bottom sheet: set the shelf count for one batch. A count of 0 closes the batch, so it asks first. */
export function EditCountSheet({
  batchNo,
  qty,
  onSave,
  onClose,
}: {
  batchNo: string;
  qty: number;
  onSave: (qty: number) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(qty);
  const [confirming, setConfirming] = useState(false);
  return (
    <Sheet onClose={onClose} title={`Edit count · batch ${batchNo}`}>
      <Stepper value={value} onChange={setValue} min={0} />
      <ButtonRow>
        <Button label="Cancel" variant="secondary" onPress={onClose} />
        <Button label="Save" onPress={() => (value === 0 ? setConfirming(true) : onSave(value))} />
      </ButtonRow>
      {confirming && (
        <ConfirmDialog
          title="Save count of 0?"
          message={`This closes batch ${batchNo}.`}
          confirmLabel="Close batch"
          destructive
          onConfirm={() => onSave(0)}
          onCancel={() => setConfirming(false)}
        />
      )}
    </Sheet>
  );
}
