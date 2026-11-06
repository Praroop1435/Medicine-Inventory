import { View } from 'react-native';
import type { BatchStatus } from '@/domain/types';
import { T } from './Text';
import { tokens } from './tokens';

const c = tokens.color;
const map: Record<
  BatchStatus,
  { bg?: string; edge?: string; ink: string; weight: 'regular' | 'medium' }
> = {
  expired: { bg: c.expiredBg, ink: c.expiredInk, weight: 'medium' },
  soon: { bg: c.soonBg, edge: c.soonEdge, ink: c.soon, weight: 'medium' },
  watch: { bg: c.watchBg, ink: c.watchInk, weight: 'medium' },
  ok: { ink: c.muted, weight: 'regular' },
};

export function StatusPill({ status, label }: { status: BatchStatus; label: string }) {
  const m = map[status];
  return (
    <View
      testID="status-pill"
      style={{
        backgroundColor: m.bg,
        borderColor: m.edge,
        borderWidth: m.edge ? 1 : 0,
        borderRadius: tokens.radius.pill,
        paddingHorizontal: m.bg ? tokens.space[2] : 0,
        paddingVertical: tokens.space[1] / 2,
        alignSelf: 'flex-start',
      }}
    >
      <T size={12} weight={m.weight} color={m.ink} numberOfLines={1}>
        {label}
      </T>
    </View>
  );
}
