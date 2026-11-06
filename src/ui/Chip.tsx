import { Pressable } from 'react-native';
import { T } from './Text';
import { tokens } from './tokens';

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        height: tokens.touch,
        justifyContent: 'center',
        paddingHorizontal: tokens.space[4],
        borderRadius: tokens.radius.control,
        borderWidth: 1,
        borderColor: selected ? tokens.color.primary : tokens.color.control,
        backgroundColor: selected ? tokens.color.primary : tokens.color.surface,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <T
        size={14}
        weight="medium"
        color={selected ? tokens.color.onPrimary : tokens.color.text}
        numberOfLines={1}
      >
        {label}
      </T>
    </Pressable>
  );
}
