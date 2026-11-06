import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { batchesByStatus } from '@/domain/alerts';
import { formatExpiry } from '@/domain/expiry';
import { useInventory } from '@/features/shared/hooks/useInventory';
import { useShop } from '@/features/shared/hooks/useShop';
import { useToday } from '@/features/shared/hooks/useToday';
import { Card, EmptyState, ListRow, Screen, Skeleton, StatusPill, T, tokens } from '@/ui';

type Status = 'expired' | 'soon' | 'watch';

export function AlertListScreen() {
  const { status } = useLocalSearchParams<{ status: string }>();
  const { batches, medicines, companies, loading } = useInventory();
  const shop = useShop();
  const today = useToday();
  if (status !== 'expired' && status !== 'soon' && status !== 'watch') return null;
  const s: Status = status;
  const title = !shop
    ? ''
    : s === 'expired'
      ? 'Expired'
      : `Expiring in ${s === 'soon' ? shop.alertDays.second : shop.alertDays.first} days`;
  const rows = shop ? batchesByStatus(batches, today, shop.alertDays, s) : [];

  return (
    <Screen title={title} back="Home">
      {loading || !shop ? (
        <Skeleton />
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing here" />
      ) : (
        <Card>
          {rows.map((b) => {
            const m = medicines.find((x) => x.id === b.medicineId);
            if (!m) return null;
            const co = companies.find((c) => c.id === m.companyId)?.name ?? '';
            return (
              <ListRow
                key={b.id}
                title={m.name}
                subtitle={`${co} · Batch ${b.batchNo}`}
                right={
                  <View style={{ alignItems: 'flex-end', gap: tokens.space[1] }}>
                    <StatusPill status={s} label={formatExpiry(b.expiry)} />
                    <T size={12} color={tokens.color.muted} numberOfLines={1}>
                      {`${b.qty} ${m.unit}${b.qty === 1 ? '' : 's'}`}
                    </T>
                  </View>
                }
                onPress={() => router.push(`/medicine/${m.id}`)}
              />
            );
          })}
        </Card>
      )}
    </Screen>
  );
}
