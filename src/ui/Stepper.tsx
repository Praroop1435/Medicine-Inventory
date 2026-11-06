import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Icon } from './Icon';
import { T } from './Text';
import { tokens } from './tokens';

export function Stepper({
  value,
  onChange,
  min = 0,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
}) {
  const btn = (label: 'Decrease' | 'Increase', delta: number, glyph: ReactNode, off: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off }}
      onPress={() => !off && onChange(value + delta)}
      style={({ pressed }) => ({
        width: tokens.touch,
        height: tokens.touch,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: off ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      {glyph}
    </Pressable>
  );
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        borderWidth: 1,
        borderColor: tokens.color.control,
        borderRadius: tokens.radius.control,
        backgroundColor: tokens.color.surface,
      }}
    >
      {btn(
        'Decrease',
        -1,
        <T size={20} weight="medium">
          −
        </T>,
        value <= min,
      )}
      <View style={{ minWidth: 48, alignItems: 'center' }}>
        <T size={16} weight="semibold" numberOfLines={1}>
          {String(value)}
        </T>
      </View>
      {btn('Increase', 1, <Icon name="plus" />, false)}
    </View>
  );
}
