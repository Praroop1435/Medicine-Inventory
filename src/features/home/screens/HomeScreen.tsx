import { useState } from 'react';
import { router } from 'expo-router';
import { alertCounts } from '@/domain/alerts';
import { useInventory } from '@/features/shared/hooks/useInventory';
import { useShop } from '@/features/shared/hooks/useShop';
import { useToday } from '@/features/shared/hooks/useToday';
import { searchInventory } from '@/domain/search';
import { childrenOf } from '@/domain/tree';
import {
  Card,
  CountStrip,
  EmptyState,
  ListRow,
  Screen,
  SearchField,
  SectionHeader,
  Skeleton,
} from '@/ui';
import { CategoryList } from '../components/CategoryList';
import { CheckReminder } from '../components/CheckReminder';
import { useSyncText } from '../components/SyncLine';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STATUS = ['expired', 'soon', 'watch'] as const;

export function HomeScreen() {
  const { batches, categories, medicines, companies, loading } = useInventory();
  const shop = useShop();
  const today = useToday();
  const sync = useSyncText();
  const [query, setQuery] = useState('');
  const results = searchInventory(query, medicines, companies, batches);
  const searching = query.replace(/\s/g, '').length >= 2;
  const counts = shop && alertCounts(batches, today, shop.alertDays);
  const date = `${DAYS[today.getDay()]} ${today.getDate()} ${MONTHS[today.getMonth()]}`;

  return (
    <Screen title={shop?.name ?? ''} meta={`${date} · ${sync}`}>
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Search medicine, company or batch"
      />
      {searching ? (
        results.length === 0 ? (
          <EmptyState title={`No medicine matches “${query.trim()}”`} />
        ) : (
          <Card>
            {results.map((r) => (
              <ListRow
                key={r.medicineId}
                title={r.title}
                subtitle={
                  r.matchedBatchNo ? `${r.subtitle} · Batch ${r.matchedBatchNo}` : r.subtitle
                }
                chevron
                onPress={() => router.push(`/medicine/${r.medicineId}`)}
              />
            ))}
          </Card>
        )
      ) : (
        <>
          {loading || !shop || !counts ? (
            <Skeleton />
          ) : (
            <CountStrip
              items={[
                { label: 'Expired', value: counts.expired, tone: 'expired' },
                { label: `In ${shop.alertDays.second} days`, value: counts.soon, tone: 'soon' },
                { label: `In ${shop.alertDays.first} days`, value: counts.watch, tone: 'ink' },
              ]}
              onPress={(i) => router.push(`/alerts/${STATUS[i]}`)}
            />
          )}
          <SectionHeader
            title="Categories"
            right={loading ? undefined : `All ${childrenOf(categories, null).length}`}
            onRightPress={() => router.push('/stock')}
          />
          <CategoryList limit={5} />
          <SectionHeader title="Stock check" />
          <CheckReminder />
        </>
      )}
    </Screen>
  );
}
