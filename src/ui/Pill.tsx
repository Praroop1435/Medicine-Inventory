import { View } from 'react-native';
import { T } from './Text';
import { tokens } from './tokens';

export function Pill({ label }: { label: string }) {
  return (
    <View
      style={{
        backgroundColor: tokens.color.selected,
        borderRadius: tokens.radius.pill,
        paddingHorizontal: tokens.space[2],
        paddingVertical: tokens.space[1] / 2,
        alignSelf: 'flex-start',
      }}
    >
      <T size={12} weight="medium" numberOfLines={1}>
        {label}
      </T>
    </View>
  );
}
