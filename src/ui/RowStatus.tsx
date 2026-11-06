import { View } from 'react-native';
import { Icon } from './Icon';
import { tokens } from './tokens';

/** A confirmed review row: green tick chip. Rows still to fix or check say so in words instead. */
export function RowStatus() {
  return (
    <View
      testID="row-status-ok"
      accessibilityLabel="Confirmed"
      style={{
        paddingHorizontal: tokens.space[2],
        paddingVertical: tokens.space[1] / 2,
        borderRadius: tokens.radius.pill,
        backgroundColor: tokens.color.okBg,
      }}
    >
      <Icon name="tick" size={tokens.font[14]} color={tokens.color.ok} />
    </View>
  );
}
