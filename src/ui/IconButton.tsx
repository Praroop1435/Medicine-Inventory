import { Pressable } from 'react-native';
import { Icon, type IconName } from './Icon';
import { tokens } from './tokens';

export function IconButton({
  icon,
  label,
  disabled,
  selected,
  onPress,
}: {
  icon: IconName;
  label: string;
  disabled?: boolean;
  /** Filled black, e.g. a ticked row. */
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected: !!selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: tokens.touch,
        height: tokens.touch,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: tokens.radius.control,
        backgroundColor: selected ? tokens.color.primary : undefined,
        opacity: disabled ? tokens.opacity.disabled : pressed ? tokens.opacity.pressed : 1,
      })}
    >
      <Icon name={icon} color={selected ? tokens.color.onPrimary : tokens.color.text} />
    </Pressable>
  );
}
