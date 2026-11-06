import { View } from 'react-native';
import { T } from './Text';
import { tokens } from './tokens';

/** A full-width expired-red notice inside a card, e.g. an expired batch. */
export function Banner({ text }: { text: string }) {
  return (
    <View
      testID="banner"
      accessibilityRole="alert"
      style={{
        backgroundColor: tokens.color.expiredBg,
        borderRadius: tokens.radius.control,
        padding: tokens.space[3],
      }}
    >
      <T size={14} weight="medium" color={tokens.color.expiredInk}>
        {text}
      </T>
    </View>
  );
}
