import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRepos } from '@/data/RepoContext';
import { medicineSummary } from '@/domain/alerts';
import { expiryDate, formatExpiry } from '@/domain/expiry';
import { unitWord } from '@/lib/format';
import type { Device, StockEvent } from '@/domain/types';
import { useSession } from '@/features/onboarding/SessionContext';
import { useInventory } from '@/features/shared/hooks/useInventory';
import { useShop } from '@/features/shared/hooks/useShop';
import { useToday } from '@/features/shared/hooks/useToday';
import { useToast } from '@/features/shared/Toast';
import { CountStrip, EmptyState, Screen, SectionHeader, Skeleton, tokens } from '@/ui';
import { useBills } from '../hooks/useBills';
import { BatchCard } from '../components/BatchCard';
import { HistoryList } from '../components/HistoryList';

export function MedicineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { categories, medicines, batches, companies, loading } = useInventory();
  const { inventory, shop: shopRepo } = useRepos();
  const session = useSession().session;
  const shop = useShop();
  const today = useToday();
  const toast = useToast();
  const [events, setEvents] = useState<StockEvent[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [all, setAll] = useState(false);
  const shopId = session?.shopId;
  const deviceId = session?.deviceId;

  useEffect(() => {
    if (!shopId || !id) return;
    const unsubs = [
      shopRepo.watchDevices(shopId, setDevices),
      inventory.watchMedicineEvents(shopId, id, all ? 100 : 3, setEvents),
    ];
    return () => unsubs.forEach((u) => u());
  }, [inventory, shopRepo, shopId, id, all]);

  const billIds = [
    ...batches.filter((b) => b.medicineId === id).map((b) => b.billId),
    ...events.map((e) => e.billId),
  ].filter((x): x is string => !!x);
  const bills = useBills(shopId, billIds);
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
  // Toasts the success message, or the failure reason; never rejects.
  const act = (f: Promise<void>, ok?: string) =>
    f.then(
      () => void (ok && toast(ok)),
      (e: unknown) =>
        toast(
          e instanceof Error ? e.message : "Couldn't save. Check the connection and try again.",
        ),
    );

  return (
    <Screen
      title={med.name}
      meta={[
        companies.find((c) => c.id === med.companyId)?.name,
        med.composition,
        `counted in ${unitWord(med.unit, 2)}`,
      ]
        .filter(Boolean)
        .join(' · ')}
      back={categories.find((c) => c.id === med.categoryId)?.name ?? 'Stock'}
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
            bill={b.billId ? bills.get(b.billId) : undefined}
            today={today}
            alertDays={shop.alertDays}
            onSold={() => act(inventory.sellOne(shopId, b.id, deviceId), `Sold 1 ${med.unit}`)}
            onSetCount={(q) => act(inventory.setCount(shopId, b.id, q, deviceId, 'count_fixed'))}
            onReturned={() =>
              act(inventory.markReturned(shopId, b.id, deviceId), 'Marked returned')
            }
          />
        ))}
      </View>
      <SectionHeader
        title="History"
        right={all ? undefined : 'All'}
        onRightPress={() => setAll(true)}
      />
      <HistoryList events={events} unit={med.unit} bills={bills} devices={devices} />
    </Screen>
  );
}
