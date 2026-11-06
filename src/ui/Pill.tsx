import { View } from 'react-native';
import { T } from './Text';
import { tokens } from './tokens';

/** A neutral label; `accent` (teal) marks something in progress, never expiry. */
export function Pill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'accent' }) {
  const accent = tone === 'accent';
  return (
    <View
      style={{
        backgroundColor: accent ? tokens.color.tealSoft : tokens.color.watchBg,
        borderRadius: tokens.radius.pill,
        paddingHorizontal: tokens.space[2],
        paddingVertical: tokens.space[1] / 2,
        alignSelf: 'flex-start',
      }}
    >
      <T
        size={12}
        weight="medium"
        color={accent ? tokens.color.tealInk : tokens.color.watchInk}
        numberOfLines={1}
      >
        {label}
      </T>
    </View>
  );
}
