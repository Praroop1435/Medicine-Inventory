import { router } from 'expo-router';
import { categorySummary } from '@/domain/alerts';
import type { BatchStatus } from '@/domain/types';
import { useInventory } from '@/features/shared/hooks/useInventory';
import { useShop } from '@/features/shared/hooks/useShop';
import { useToday } from '@/features/shared/hooks/useToday';
import { Card, ListRow, Skeleton, StatusPill } from '@/ui';

const label = (worst: BatchStatus | null, n: number, first: number) =>
  worst === 'expired' ? `${n} expired` : worst === 'soon' ? `${n} soon` : `${n} in ${first} days`;

/** Category rows with the worst-status pill. Reused by the Stock tab. */
export function CategoryList({ limit }: { limit?: number }) {
  const { categories, medicines, batches, loading } = useInventory();
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
  return (
    <Card>
      {rows.map((c) => {
        const s = categorySummary(c.id, medicines, batches, today, shop.alertDays);
        return (
          <ListRow
            key={c.id}
            title={c.name}
            subtitle={`${s.medicineCount} medicines · ${s.unitCount} units`}
            right={
              s.worst && s.worst !== 'ok' ? (
                <StatusPill
                  status={s.worst}
                  label={label(s.worst, s.worstCount, shop.alertDays.first)}
                />
              ) : null
            }
            chevron
            onPress={() => router.push(`/category/${c.id}`)}
          />
        );
      })}
    </Card>
  );
}
