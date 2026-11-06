import { Pressable, View } from 'react-native';
import { T } from './Text';
import { tokens, type Tone } from './tokens';

type Item = { label: string; value: number | string; tone?: Tone };
const toneColor: Record<Tone, string> = {
  expired: tokens.color.expired,
  soon: tokens.color.soon,
  ink: tokens.color.text,
};

export function CountStrip({
  items,
  selectedIndex,
  onPress,
}: {
  items: Item[];
  selectedIndex?: number;
  onPress?: (i: number) => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: tokens.color.surface,
        borderColor: tokens.color.border,
        borderWidth: 1,
        borderRadius: tokens.radius.card,
        overflow: 'hidden',
      }}
    >
      {items.map((it, i) => (
        <Pressable
          key={it.label}
          accessibilityRole="button"
          accessibilityLabel={`${it.label} ${it.value}`}
          accessibilityState={{ selected: selectedIndex === i }}
          onPress={() => onPress?.(i)}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: tokens.touch,
            alignItems: 'center',
            paddingVertical: tokens.space[3],
            borderLeftWidth: i === 0 ? 0 : 1,
            borderLeftColor: tokens.color.border,
            backgroundColor: selectedIndex === i ? tokens.color.selected : undefined,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <T size={20} weight="semibold" color={toneColor[it.tone ?? 'ink']} numberOfLines={1}>
            {String(it.value)}
          </T>
          <T size={12} color={tokens.color.muted} numberOfLines={1}>
            {it.label}
          </T>
        </Pressable>
      ))}
    </View>
  );
}
