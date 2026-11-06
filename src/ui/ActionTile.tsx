import { Pressable } from 'react-native';
import type { IconName } from './Icon';
import { IconTile } from './IconTile';
import { T } from './Text';
import { tokens } from './tokens';

/** A big tappable choice: icon, label and one line saying what it does (Add sheet). */
export function ActionTile({
  icon,
  label,
  subtitle,
  onPress,
}: {
  icon: IconName;
  label: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={subtitle}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: tokens.actionTile,
        gap: tokens.space[2],
        padding: tokens.space[4],
        borderRadius: tokens.radius.card,
        borderWidth: 1,
        borderColor: tokens.color.border,
        backgroundColor: tokens.color.surface,
        opacity: pressed ? tokens.opacity.pressed : 1,
      })}
    >
      <IconTile icon={icon} round />
      <T size={16} weight="semibold" numberOfLines={1}>
        {label}
      </T>
      <T size={12} color={tokens.color.muted} numberOfLines={2}>
        {subtitle}
      </T>
    </Pressable>
  );
}
