import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Button, ButtonRow, Stepper, T, tokens } from '@/ui';

/** Bottom sheet: set the shelf count for one batch. */
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
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityLabel="Close"
        onPress={onClose}
        style={{ flex: 1, backgroundColor: tokens.color.scrim }}
      />
      <View
        style={{
          backgroundColor: tokens.color.surface,
          borderTopLeftRadius: tokens.radius.card,
          borderTopRightRadius: tokens.radius.card,
          padding: tokens.margin,
          gap: tokens.space[3],
        }}
      >
        <T size={16} weight="medium">{`Edit count · batch ${batchNo}`}</T>
        <Stepper value={value} onChange={setValue} min={0} />
        <ButtonRow>
          <Button label="Cancel" variant="secondary" onPress={onClose} />
          <Button label="Save" onPress={() => onSave(value)} />
        </ButtonRow>
      </View>
    </Modal>
  );
}
