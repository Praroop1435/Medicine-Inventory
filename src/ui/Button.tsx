import { Pressable } from 'react-native';
import { T } from './Text';
import { tokens } from './tokens';

type Props = {
  label: string;
  variant?: 'primary' | 'secondary';
  onPress: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  disabled?: boolean;
  full?: boolean;
};

export function Button({
  label,
  variant = 'primary',
  onPress,
  onPressIn,
  onPressOut,
  disabled,
  full,
}: Props) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={({ pressed }) => ({
        height: full ? 48 : tokens.touch,
        alignSelf: full ? 'stretch' : undefined,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: tokens.space[4],
        borderRadius: tokens.radius.control,
        backgroundColor: primary ? tokens.color.primary : tokens.color.surface,
        borderWidth: primary ? 0 : 1,
        borderColor: tokens.color.control,
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <T
        size={14}
        weight="medium"
        color={primary ? tokens.color.onPrimary : tokens.color.text}
        numberOfLines={1}
      >
        {label}
      </T>
    </Pressable>
  );
}
