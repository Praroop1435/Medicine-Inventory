import { Pressable } from 'react-native';
import { T } from './Text';
import { tokens } from './tokens';

type Props = {
  label: string;
  /** primary = navy fill; secondary = white with a border; text = teal words only (links). */
  variant?: 'primary' | 'secondary' | 'danger' | 'text';
  onPress: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  disabled?: boolean;
  full?: boolean;
  /** Read by screen readers, e.g. why the button is disabled. */
  accessibilityHint?: string;
};

export function Button({
  label,
  variant = 'primary',
  onPress,
  onPressIn,
  onPressOut,
  disabled,
  full,
  accessibilityHint,
}: Props) {
  const filled = variant === 'primary' || variant === 'danger';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
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
        backgroundColor:
          variant === 'danger'
            ? tokens.color.expired
            : variant === 'primary'
              ? tokens.color.primary
              : variant === 'secondary'
                ? tokens.color.surface
                : undefined,
        borderWidth: variant === 'secondary' ? 1 : 0,
        borderColor: tokens.color.control,
        opacity: disabled ? tokens.opacity.disabled : pressed ? tokens.opacity.pressed : 1,
      })}
    >
      <T
        size={14}
        weight={variant === 'text' ? 'semibold' : 'medium'}
        color={
          filled
            ? tokens.color.onPrimary
            : variant === 'text'
              ? tokens.color.tealInk
              : tokens.color.text
        }
        numberOfLines={1}
      >
        {label}
      </T>
    </Pressable>
  );
}
