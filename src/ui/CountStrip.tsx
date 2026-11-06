import { Pressable, View } from 'react-native';
import { T } from './Text';
import { tokens, type Tone } from './tokens';

type Item = { label: string; value: number | string; tone?: Tone };
const toneColor: Record<Tone, string> = {
  expired: tokens.color.expired,
  soon: tokens.color.soon,
  ink: tokens.color.text,
};

/** A row of counts. Zero is never a warning: a 0 shows muted whatever its tone. */
export function CountStrip({
  items,
  selectedIndex,
  onPress,
  large,
}: {
  items: Item[];
  selectedIndex?: number;
  onPress?: (i: number) => void;
  /** 32pt numbers; Home only. */
  large?: boolean;
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
          <T
            size={large ? 32 : 20}
            weight="semibold"
            color={it.value === 0 ? tokens.color.muted : toneColor[it.tone ?? 'ink']}
            numberOfLines={1}
          >
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
