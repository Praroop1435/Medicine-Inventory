import type { ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { T } from './Text';
import { tokens } from './tokens';

/** Bottom sheet over a scrim; tapping the scrim or Android back closes it. */
export function Sheet({
  onClose,
  title,
  children,
}: {
  onClose: () => void;
  /** Shown as the sheet's header under the grab handle. */
  title?: string;
  children: ReactNode;
}) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityLabel="Close"
        onPress={onClose}
        // Keeps a strip of scrim to tap even when a long sheet takes the rest of the screen.
        style={{ flexGrow: 1, minHeight: tokens.row, backgroundColor: tokens.color.scrim }}
      />
      <View
        testID="sheet"
        style={{
          backgroundColor: tokens.color.surface,
          borderTopLeftRadius: tokens.radius.sheet,
          borderTopRightRadius: tokens.radius.sheet,
          padding: tokens.margin,
          paddingTop: tokens.space[2],
          gap: tokens.space[3],
          flexShrink: 1,
          ...tokens.shadow,
        }}
      >
        <View
          testID="sheet-handle"
          style={{
            alignSelf: 'center',
            width: tokens.handle.width,
            height: tokens.handle.height,
            borderRadius: tokens.handle.height / 2,
            backgroundColor: tokens.color.control,
          }}
        />
        {title ? (
          <T size={20} weight="semibold" accessibilityRole="header">
            {title}
          </T>
        ) : null}
        {children}
      </View>
    </Modal>
  );
}
