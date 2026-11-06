import { useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { alertCounts } from '@/domain/alerts';
import { useInventory } from '@/features/shared/hooks/useInventory';
import { useShop } from '@/features/shared/hooks/useShop';
import { useToday } from '@/features/shared/hooks/useToday';
import { searchInventory } from '@/domain/search';
import {
  Card,
  CountStrip,
  EmptyState,
  ListRow,
  Logo,
  Screen,
  SearchField,
  SectionHeader,
  Skeleton,
  T,
  tokens,
} from '@/ui';
import { CategoryList } from '../components/CategoryList';
import { CheckReminder } from '../components/CheckReminder';
import { FirstStockCard } from '../components/FirstStockCard';
import { useSyncText } from '../components/SyncLine';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STATUS = ['expired', 'soon', 'watch'] as const;

export function HomeScreen() {
  const { batches, medicines, companies, loading } = useInventory();
  const shop = useShop();
  const today = useToday();
  const sync = useSyncText();
  const [query, setQuery] = useState('');
  const results = searchInventory(query, medicines, companies, batches);
  const searching = query.replace(/\s/g, '').length >= 2;
  const counts = shop && alertCounts(batches, today, shop.alertDays);
  const date = `${DAYS[today.getDay()]} ${today.getDate()} ${MONTHS[today.getMonth()]}`;
  const firstRun = !loading && medicines.length === 0;

  return (
    <Screen
      band={
        <View style={{ gap: tokens.space[2] }}>
          <Logo size={tokens.logo.mark} variant="white" />
          <View>
            <T
              size={24}
              weight="semibold"
              color={tokens.color.onPrimary}
              accessibilityRole="header"
              numberOfLines={1}
            >
              {shop?.name ?? ''}
            </T>
            <T size={12} color={tokens.color.onPrimaryMuted}>{`${date} · ${sync}`}</T>
          </View>
        </View>
      }
      bandEdge={
        <SearchField
          floating
          value={query}
          onChangeText={setQuery}
          placeholder="Search medicine, company or batch"
        />
      }
    >
      {searching ? (
        results.length === 0 ? (
          <EmptyState
            icon="no-results"
            title={`No medicine matches “${query.trim()}”`}
            body="Try the name on the strip, the company, or the batch number."
          />
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
              large
              items={[
                { label: 'Expired', value: counts.expired, tone: 'expired' },
                { label: `In ${shop.alertDays.second} days`, value: counts.soon, tone: 'soon' },
                { label: `In ${shop.alertDays.first} days`, value: counts.watch, tone: 'ink' },
              ]}
              onPress={(i) => router.push(`/alerts/${STATUS[i]}`)}
            />
          )}
          {firstRun ? (
            <View style={{ paddingTop: tokens.space[4] }}>
              <FirstStockCard />
            </View>
          ) : (
            <>
              <SectionHeader
                title="Categories"
                right={loading ? undefined : 'See all'}
                onRightPress={() => router.push('/stock')}
              />
              <CategoryList limit={5} />
              <CheckReminder />
            </>
          )}
        </>
      )}
    </Screen>
  );
}
