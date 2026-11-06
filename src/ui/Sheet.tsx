import type { ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { tokens } from './tokens';

/** Bottom sheet over a scrim; tapping the scrim or Android back closes it. */
export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityLabel="Close"
        onPress={onClose}
        // Keeps a strip of scrim to tap even when a long sheet takes the rest of the screen.
        style={{ flexGrow: 1, minHeight: tokens.row, backgroundColor: tokens.color.scrim }}
      />
      <View
        style={{
          backgroundColor: tokens.color.surface,
          borderTopLeftRadius: tokens.radius.card,
          borderTopRightRadius: tokens.radius.card,
          padding: tokens.margin,
          gap: tokens.space[3],
          flexShrink: 1,
        }}
      >
        {children}
      </View>
    </Modal>
  );
}
