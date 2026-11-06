import { Pressable } from 'react-native';
import { Icon, type IconName } from './Icon';
import { tokens } from './tokens';

export function IconButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: IconName;
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: tokens.touch,
        height: tokens.touch,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? tokens.opacity.disabled : pressed ? tokens.opacity.pressed : 1,
      })}
    >
      <Icon name={icon} />
    </Pressable>
  );
}
