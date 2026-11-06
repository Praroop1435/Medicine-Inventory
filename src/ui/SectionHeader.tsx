import { Pressable, View } from 'react-native';
import { T } from './Text';
import { tokens } from './tokens';

export function SectionHeader({
  title,
  right,
  onRightPress,
}: {
  title: string;
  right?: string;
  onRightPress?: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: tokens.space[5],
        paddingBottom: tokens.space[2],
      }}
    >
      <T size={12} weight="medium" color={tokens.color.muted} accessibilityRole="header">
        {title.toUpperCase()}
      </T>
      {right ? (
        <Pressable
          accessibilityRole={onRightPress ? 'button' : undefined}
          accessibilityLabel={right}
          disabled={!onRightPress}
          onPress={onRightPress}
          hitSlop={tokens.space[2]}
        >
          <T size={12} color={tokens.color.muted}>
            {right}
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}
