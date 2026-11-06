import { router } from 'expo-router';
import { View } from 'react-native';
import { childrenOf, rollupSummary } from '@/domain/tree';
import type { BatchStatus, Category } from '@/domain/types';
import { useRepos } from '@/data/RepoContext';
import { useSession } from '@/features/onboarding/SessionContext';
import { medicineCount } from '@/lib/format';
import { useInventory } from '@/features/shared/hooks/useInventory';
import { useShop } from '@/features/shared/hooks/useShop';
import { useToday } from '@/features/shared/hooks/useToday';
import { Card, IconButton, ListRow, Skeleton, StatusPill } from '@/ui';

const label = (worst: BatchStatus | null, n: number, first: number) =>
  worst === 'expired' ? `${n} expired` : worst === 'soon' ? `${n} soon` : `${n} in ${first} days`;

/** One sibling group of folders with rolled-up counts and worst-status pill (Home, Stock, folders). */
export function CategoryList({
  parentId = null,
  limit,
  editable,
  onMenu,
}: {
  parentId?: string | null;
  limit?: number;
  editable?: boolean;
  /** Adds a ⋯ button per row. */
  onMenu?: (c: Category) => void;
}) {
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
  const sorted = childrenOf(categories, parentId);
  const rows = sorted.slice(0, limit);
  if (sorted.length === 0) return null;
  // Renumbers the whole sibling group so duplicate `order` values still move.
  const move = (i: number, d: -1 | 1) => {
    if (!session || !sorted[i + d]) return;
    const ids = sorted.map((c) => c.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    void inventory.reorderCategories(session.shopId, ids, session.deviceId);
  };
  return (
    <Card>
      {rows.map((c, i) => {
        const s = rollupSummary(categories, medicines, batches, c.id, today, shop.alertDays);
        return (
          <ListRow
            key={c.id}
            icon="folder"
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
              ) : (
                <>
                  {s.worst && s.worst !== 'ok' ? (
                    <StatusPill
                      status={s.worst}
                      label={label(s.worst, s.worstCount, shop.alertDays.first)}
                    />
                  ) : null}
                  {onMenu ? (
                    <IconButton icon="more" label={`More, ${c.name}`} onPress={() => onMenu(c)} />
                  ) : null}
                </>
              )
            }
            chevron={!editable}
            onPress={editable ? undefined : () => router.push(`/category/${c.id}`)}
          />
        );
      })}
    </Card>
  );
}
