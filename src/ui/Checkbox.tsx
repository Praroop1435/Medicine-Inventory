import { Pressable, View } from 'react-native';
import { Icon } from './Icon';
import { T } from './Text';
import { tokens } from './tokens';

/** A labelled on/off choice; the whole row is the touch target. */
export function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => ({
        minHeight: tokens.touch,
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.space[3],
        opacity: pressed ? tokens.opacity.pressed : 1,
      })}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: checked ? tokens.color.navy : tokens.color.control,
          backgroundColor: checked ? tokens.color.navy : tokens.color.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? (
          <Icon name="tick" size={tokens.font[16]} color={tokens.color.onPrimary} />
        ) : null}
      </View>
      <T size={14} style={{ flex: 1 }}>
        {label}
      </T>
    </Pressable>
  );
}
