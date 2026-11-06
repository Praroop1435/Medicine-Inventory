import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Icon, type IconName } from './Icon';
import { IconTile } from './IconTile';
import { T } from './Text';
import { tokens } from './tokens';

type Props = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  chevron?: boolean;
  onPress?: () => void;
  /** Shown dimmed and not pressable, e.g. a menu item that can't be used yet. */
  disabled?: boolean;
  /** Leading teal icon tile, e.g. a folder. */
  icon?: IconName;
  /** What a screen reader says when the default (title, subtitle) misses a status shown on the right. */
  accessibilityLabel?: string;
};

export function ListRow({
  title,
  subtitle,
  right,
  chevron,
  onPress,
  disabled,
  icon,
  accessibilityLabel,
}: Props) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}
      accessibilityState={onPress ? { disabled: !!disabled } : undefined}
      disabled={!onPress || disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: tokens.row,
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.space[3],
        paddingHorizontal: tokens.space[4],
        paddingVertical: tokens.space[2],
        borderBottomWidth: 1,
        borderBottomColor: tokens.color.rule,
        opacity: disabled ? tokens.opacity.disabled : pressed ? tokens.opacity.pressed : 1,
      })}
    >
      {icon ? <IconTile icon={icon} /> : null}
      <View style={{ flex: 1 }}>
        <T size={16} weight="medium" numberOfLines={1}>
          {title}
        </T>
        {subtitle ? (
          <T size={12} color={tokens.color.muted} numberOfLines={1}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right}
      {chevron ? <Icon name="chevron-right" color={tokens.color.muted} /> : null}
    </Pressable>
  );
}
