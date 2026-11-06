import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Icon } from './Icon';
import { T } from './Text';
import { tokens } from './tokens';

type Props = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  chevron?: boolean;
  onPress?: () => void;
};

export function ListRow({ title, subtitle, right, chevron, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      disabled={!onPress}
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
        opacity: pressed ? 0.7 : 1,
      })}
    >
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
