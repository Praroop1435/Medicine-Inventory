import { View } from 'react-native';
import { Icon } from './Icon';
import { T } from './Text';
import { tokens } from './tokens';

const LOOK = {
  fix: { bg: tokens.color.expiredBg, ink: tokens.color.expiredInk, text: 'Fix' },
  check: { bg: tokens.color.soonBg, ink: tokens.color.soon, text: 'Check' },
  ok: { bg: tokens.color.okBg, ink: tokens.color.ok, text: 'Confirmed' },
} as const;

/** Where a reviewed row stands: red Fix (something missing), amber Check (unsure), green tick. */
export function RowStatus({ state }: { state: keyof typeof LOOK }) {
  const l = LOOK[state];
  return (
    <View
      testID={`row-status-${state}`}
      accessibilityLabel={l.text}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.space[1],
        paddingHorizontal: tokens.space[2],
        paddingVertical: tokens.space[1] / 2,
        borderRadius: tokens.radius.pill,
        backgroundColor: l.bg,
      }}
    >
      {state === 'ok' ? (
        <Icon name="tick" size={tokens.font[14]} color={l.ink} />
      ) : (
        <T size={12} weight="medium" color={l.ink}>
          {l.text}
        </T>
      )}
    </View>
  );
}
