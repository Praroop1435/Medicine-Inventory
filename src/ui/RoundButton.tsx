import { Pressable, View } from 'react-native';
import { Icon, type IconName } from './Icon';
import { T } from './Text';
import { tokens } from './tokens';

/** A small round icon button with a short caption under it, e.g. Gallery / PDF beside the shutter. */
export function RoundButton({
  icon,
  caption,
  label,
  onPress,
}: {
  icon: IconName;
  caption: string;
  /** What a screen reader says, e.g. "Photo from gallery". */
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        gap: tokens.space[1],
        opacity: pressed ? tokens.opacity.pressed : 1,
      })}
    >
      <View
        style={{
          width: tokens.touch + tokens.space[1],
          height: tokens.touch + tokens.space[1],
          borderRadius: tokens.radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tokens.color.tealSoft,
        }}
      >
        <Icon name={icon} color={tokens.color.tealInk} />
      </View>
      <T size={12} color={tokens.color.muted}>
        {caption}
      </T>
    </Pressable>
  );
}
