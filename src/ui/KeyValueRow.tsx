import { View } from 'react-native';
import { T } from './Text';
import { tokens } from './tokens';

export function KeyValueRow({ label, value }: { label: string; value: string }) {
  return (
    // Not tappable, so no 44 touch height: rows sit evenly at the text's own height.
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: tokens.space[1] }}>
      <View style={{ width: tokens.labelCol }}>
        <T size={12} color={tokens.color.muted} numberOfLines={1}>
          {label}
        </T>
      </View>
      <View style={{ flex: 1 }}>
        <T size={14} numberOfLines={1}>
          {value}
        </T>
      </View>
    </View>
  );
}
