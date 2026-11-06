import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { categorySummary } from '@/domain/alerts';
import type { BatchStatus } from '@/domain/types';
import { useRepos } from '@/data/RepoContext';
import { useSession } from '@/features/onboarding/SessionContext';
import { useInventory } from '@/features/shared/hooks/useInventory';
import { useShop } from '@/features/shared/hooks/useShop';
import { useToday } from '@/features/shared/hooks/useToday';
import { Card, Icon, ListRow, Skeleton, StatusPill, tokens } from '@/ui';

const label = (worst: BatchStatus | null, n: number, first: number) =>
  worst === 'expired' ? `${n} expired` : worst === 'soon' ? `${n} soon` : `${n} in ${first} days`;

/** Category rows with the worst-status pill. Reused by the Stock tab. */
export function CategoryList({ limit, editable }: { limit?: number; editable?: boolean }) {
  const { categories, medicines, batches, loading } = useInventory();
  const { inventory } = useRepos();
  const shopId = useSession().session?.shopId;
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
  const rows = [...categories].sort((a, b) => a.order - b.order).slice(0, limit);
  // Swap `order` with the neighbour; shopId is set whenever shop is.
  const move = (i: number, d: -1 | 1) => {
    const a = rows[i];
    const b = rows[i + d];
    if (!shopId || !a || !b) return;
    void inventory.upsertCategory(shopId, { ...a, order: b.order });
    void inventory.upsertCategory(shopId, { ...b, order: a.order });
  };
  return (
    <Card>
      {rows.map((c, i) => {
        const s = categorySummary(c.id, medicines, batches, today, shop.alertDays);
        return (
          <ListRow
            key={c.id}
            title={c.name}
            subtitle={`${s.medicineCount} medicines · ${s.unitCount} units`}
            right={
              editable ? (
                <View style={{ flexDirection: 'row' }}>
                  {([-1, 1] as const).map((d) => (
                    <Pressable
                      key={d}
                      accessibilityRole="button"
                      accessibilityLabel={`Move ${c.name} ${d < 0 ? 'up' : 'down'}`}
                      disabled={i + d < 0 || i + d >= rows.length}
                      onPress={() => move(i, d)}
                      style={({ pressed }) => ({
                        width: tokens.touch,
                        height: tokens.touch,
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: i + d < 0 || i + d >= rows.length ? 0.3 : pressed ? 0.7 : 1,
                      })}
                    >
                      <Icon name={d < 0 ? 'up' : 'down'} />
                    </Pressable>
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
