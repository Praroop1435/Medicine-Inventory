import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRepos } from '@/data/RepoContext';
import { medicineSummary } from '@/domain/alerts';
import { expiryDate, formatExpiry } from '@/domain/expiry';
import type { Bill, Device, StockEvent } from '@/domain/types';
import { useSession } from '@/features/onboarding/SessionContext';
import { useInventory } from '@/features/shared/hooks/useInventory';
import { useShop } from '@/features/shared/hooks/useShop';
import { useToday } from '@/features/shared/hooks/useToday';
import { useToast } from '@/features/shared/Toast';
import { CountStrip, EmptyState, Screen, SectionHeader, Skeleton, tokens } from '@/ui';
import { BatchCard } from '../components/BatchCard';
import { HistoryList } from '../components/HistoryList';

export function MedicineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { medicines, batches, companies, loading } = useInventory();
  const { inventory, shop: shopRepo } = useRepos();
  const session = useSession().session;
  const shop = useShop();
  const today = useToday();
  const toast = useToast();
  const [events, setEvents] = useState<StockEvent[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [all, setAll] = useState(false);
  const shopId = session?.shopId;
  const deviceId = session?.deviceId;

  useEffect(() => {
    if (!shopId || !id) return;
    const unsubs = [
      inventory.watchBills(shopId, setBills),
      shopRepo.watchDevices(shopId, setDevices),
      inventory.watchMedicineEvents(shopId, id, all ? 100 : 3, setEvents),
    ];
    return () => unsubs.forEach((u) => u());
  }, [inventory, shopRepo, shopId, id, all]);

  const med = medicines.find((m) => m.id === id);
  if (loading || !shop || !shopId || !deviceId)
    return (
      <Screen back="Stock">
        <Skeleton />
      </Screen>
    );
  if (!med)
    return (
      <Screen back="Stock">
        <EmptyState title="Medicine not found" />
      </Screen>
    );

  const s = medicineSummary(med.id, batches, today, shop.alertDays);
  const live = batches
    .filter((b) => b.medicineId === med.id)
    .sort((a, b) => expiryDate(a.expiry).getTime() - expiryDate(b.expiry).getTime());
  const tone = s.worst === 'expired' ? 'expired' : s.worst === 'soon' ? 'soon' : 'ink';
  const done = (msg: string) => () => toast(msg);

  return (
    <Screen
      title={med.name}
      meta={companies.find((c) => c.id === med.companyId)?.name}
      back="Stock"
    >
      <CountStrip
        items={[
          { label: 'In stock', value: s.qty },
          { label: 'Batches', value: s.batchCount },
          { label: 'Next expiry', value: s.next ? formatExpiry(s.next) : '-', tone },
        ]}
      />
      <SectionHeader
        title="Batches"
        right="+ Add batch"
        onRightPress={() => router.push(`/intake/manual?medicineId=${med.id}`)}
      />
      <View style={{ gap: tokens.space[3] }}>
        {live.map((b) => (
          <BatchCard
            key={b.id}
            batch={b}
            unit={med.unit}
            bill={bills.find((x) => x.id === b.billId)}
            today={today}
            alertDays={shop.alertDays}
            onSold={() =>
              inventory.sellOne(shopId, b.id, deviceId).then(done(`Sold 1 ${med.unit}`))
            }
            onSetCount={(q) => void inventory.setCount(shopId, b.id, q, deviceId, 'count_fixed')}
            onReturned={() =>
              inventory.markReturned(shopId, b.id, deviceId).then(done('Marked returned'))
            }
          />
        ))}
      </View>
      <SectionHeader
        title="History"
        right={all ? undefined : 'All'}
        onRightPress={() => setAll(true)}
      />
      <HistoryList
        events={events}
        unit={med.unit}
        batches={batches}
        bills={bills}
        devices={devices}
      />
    </Screen>
  );
}
