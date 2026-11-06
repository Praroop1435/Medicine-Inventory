import { router } from 'expo-router';
import { View } from 'react-native';
import { categorySummary } from '@/domain/alerts';
import type { BatchStatus } from '@/domain/types';
import { useRepos } from '@/data/RepoContext';
import { useSession } from '@/features/onboarding/SessionContext';
import { medicineCount } from '@/lib/format';
import { useInventory } from '@/features/shared/hooks/useInventory';
import { useShop } from '@/features/shared/hooks/useShop';
import { useToday } from '@/features/shared/hooks/useToday';
import { Card, IconButton, ListRow, Skeleton, StatusPill } from '@/ui';

const label = (worst: BatchStatus | null, n: number, first: number) =>
  worst === 'expired' ? `${n} expired` : worst === 'soon' ? `${n} soon` : `${n} in ${first} days`;

/** Category rows with the worst-status pill. Reused by the Stock tab. */
export function CategoryList({ limit, editable }: { limit?: number; editable?: boolean }) {
  const { categories, medicines, batches, loading } = useInventory();
  const { inventory } = useRepos();
  const { session } = useSession();
  const shop = useShop();
  const today = useToday();
  if (loading || !shop)
    return (
      <Card>
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </Card>
    );
  const sorted = [...categories].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  const rows = sorted.slice(0, limit);
  // Renumbers the whole list so duplicate `order` values still move.
  const move = (i: number, d: -1 | 1) => {
    if (!session || !sorted[i + d]) return;
    const ids = sorted.map((c) => c.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    void inventory.reorderCategories(session.shopId, ids, session.deviceId);
  };
  return (
    <Card>
      {rows.map((c, i) => {
        const s = categorySummary(c.id, medicines, batches, today, shop.alertDays);
        return (
          <ListRow
            key={c.id}
            title={c.name}
            subtitle={`${medicineCount(s.medicineCount)} · ${s.unitCount} units`}
            right={
              editable ? (
                <View style={{ flexDirection: 'row' }}>
                  {([-1, 1] as const).map((d) => (
                    <IconButton
                      key={d}
                      icon={d < 0 ? 'up' : 'down'}
                      label={`Move ${c.name} ${d < 0 ? 'up' : 'down'}`}
                      disabled={i + d < 0 || i + d >= rows.length}
                      onPress={() => move(i, d)}
                    />
                  ))}
                </View>
              ) : s.worst && s.worst !== 'ok' ? (
                <StatusPill
                  status={s.worst}
                  label={label(s.worst, s.worstCount, shop.alertDays.first)}
                />
              ) : null
            }
            chevron={!editable}
            onPress={editable ? undefined : () => router.push(`/category/${c.id}`)}
          />
        );
      })}
    </Card>
  );
}
