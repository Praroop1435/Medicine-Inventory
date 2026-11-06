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
        minHeight: tokens.touch,
        paddingTop: tokens.space[2],
      }}
    >
      <T size={14} weight="semibold" accessibilityRole="header">
        {title}
      </T>
      {right ? (
        <Pressable
          accessibilityRole={onRightPress ? 'button' : undefined}
          accessibilityLabel={right}
          disabled={!onRightPress}
          onPress={onRightPress}
          style={{
            minHeight: tokens.touch,
            justifyContent: 'center',
            paddingLeft: tokens.space[3],
          }}
        >
          <T
            size={14}
            weight="medium"
            color={onRightPress ? tokens.color.tealInk : tokens.color.muted}
          >
            {right}
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}
