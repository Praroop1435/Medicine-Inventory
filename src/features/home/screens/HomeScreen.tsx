import { router } from 'expo-router';
import { alertCounts } from '@/domain/alerts';
import { useInventory } from '@/features/shared/hooks/useInventory';
import { useShop } from '@/features/shared/hooks/useShop';
import { useToday } from '@/features/shared/hooks/useToday';
import { CountStrip, Screen, SectionHeader, Skeleton } from '@/ui';
import { CategoryList } from '../components/CategoryList';
import { CheckReminder } from '../components/CheckReminder';
import { useSyncText } from '../components/SyncLine';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STATUS = ['expired', 'soon', 'watch'] as const;

export function HomeScreen() {
  const { batches, categories, loading } = useInventory();
  const shop = useShop();
  const today = useToday();
  const sync = useSyncText();
  const counts = shop && alertCounts(batches, today, shop.alertDays);
  const date = `${DAYS[today.getDay()]} ${today.getDate()} ${MONTHS[today.getMonth()]}`;

  return (
    <Screen title={shop?.name ?? ''} meta={`${date} · ${sync}`}>
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
      <SectionHeader title="Categories" right={loading ? undefined : `All ${categories.length}`} />
      <CategoryList limit={5} />
      <SectionHeader title="Stock check" />
      <CheckReminder />
    </Screen>
  );
}
