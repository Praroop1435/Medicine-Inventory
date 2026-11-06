import { Modal, View } from 'react-native';
import { Button } from './Button';
import { ButtonRow } from './ButtonRow';
import { T } from './Text';
import { tokens } from './tokens';

/** Asks before a destructive action (§11.4). Android back cancels. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  destructive,
  onConfirm,
  onCancel,
}: {
  title: string;
  message?: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: tokens.margin,
          backgroundColor: tokens.color.scrim,
        }}
      >
        <View
          testID="confirm-dialog"
          accessibilityViewIsModal
          style={{
            backgroundColor: tokens.color.surface,
            borderRadius: tokens.radius.card,
            padding: tokens.margin,
            gap: tokens.space[3],
          }}
        >
          <T size={16} weight="semibold" accessibilityRole="header">
            {title}
          </T>
          {message ? <T size={14}>{message}</T> : null}
          <ButtonRow>
            <Button label="Cancel" variant="secondary" onPress={onCancel} />
            <Button
              label={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              onPress={onConfirm}
            />
          </ButtonRow>
        </View>
      </View>
    </Modal>
  );
}
