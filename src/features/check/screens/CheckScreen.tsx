import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useRepos } from '@/data/RepoContext';
import type { CheckSession } from '@/data/repositories';
import { batchStatus, formatExpiry } from '@/domain/expiry';
import type { Batch, Device } from '@/domain/types';
import { useSession } from '@/features/onboarding/SessionContext';
import { useInventory } from '@/features/shared/hooks/useInventory';
import { useShop } from '@/features/shared/hooks/useShop';
import { useToday } from '@/features/shared/hooks/useToday';
import { useToast } from '@/features/shared/Toast';
import {
  Button,
  ButtonRow,
  Card,
  EmptyState,
  IconButton,
  ProgressBar,
  Screen,
  SectionHeader,
  Skeleton,
  Stepper,
  T,
  tokens,
} from '@/ui';

type Row = { batch: Batch; name: string; company: string };

/** Routine stock check of one category (§6.5): tick if the shelf matches, or fix the count first. */
export function CheckScreen() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const { categories, medicines, companies, batches, loading } = useInventory();
  const { check, shop: shopRepo } = useRepos();
  const session = useSession().session;
  const shop = useShop();
  const today = useToday();
  const toast = useToast();
  const [progress, setProgress] = useState<CheckSession | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  // Stepper values the user changed and hasn't ticked yet, by batch id.
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [confirming, setConfirming] = useState(false);
  const finishing = useRef(false);
  const shopId = session?.shopId;
  const deviceId = session?.deviceId;

  useEffect(() => {
    if (!shopId || !categoryId) return;
    const unsubs = [
      check.watchCheck(shopId, categoryId, setProgress),
      shopRepo.watchDevices(shopId, setDevices),
    ];
    return () => unsubs.forEach((u) => u());
  }, [check, shopRepo, shopId, categoryId]);

  const category = categories.find((c) => c.id === categoryId);
  if (loading || !shop || !shopId || !deviceId)
    return (
      <Screen back="Check">
        <Skeleton />
      </Screen>
    );
  if (!category)
    return (
      <Screen back="Check">
        <EmptyState title="Category not found" />
      </Screen>
    );

  const rows: Row[] = batches.flatMap((batch) => {
    const m = medicines.find((x) => x.id === batch.medicineId);
    if (m?.categoryId !== category.id) return [];
    return [
      { batch, name: m.name, company: companies.find((c) => c.id === m.companyId)?.name ?? '' },
    ];
  });
  rows.sort(
    (a, b) =>
      a.company.localeCompare(b.company) ||
      a.name.localeCompare(b.name) ||
      a.batch.expiry.year - b.batch.expiry.year ||
      a.batch.expiry.month - b.batch.expiry.month,
  );
  const groups = [...new Set(rows.map((r) => r.company))];
  const ticks = progress?.checked ?? {};
  const done = rows.filter((r) => ticks[r.batch.id]).length;
  const total = rows.length;
  const last = Object.values(ticks).sort((a, b) => b.at - a.at)[0];
  const lastName = last && devices.find((d) => d.id === last.by)?.displayName;

  const mark = (b: Batch) =>
    check.markChecked(shopId, category.id, b.id, edits[b.id] ?? b.qty, deviceId).then(
      () => setEdits((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== b.id))),
      (e: unknown) => toast(e instanceof Error ? e.message : 'Something went wrong'),
    );

  const finish = async () => {
    if (finishing.current) return;
    finishing.current = true;
    try {
      const { complete } = await check.finishCheck(
        shopId,
        category.id,
        rows.map((r) => r.batch.id),
      );
      toast(complete ? `${category.name} checked` : `Saved progress · ${done} of ${total} checked`);
      router.back();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      finishing.current = false;
    }
  };

  return (
    <Screen
      back="Check"
      title={category.name}
      meta={`${done} of ${total} batches checked${lastName ? ` · ${lastName}` : ''}`}
      footer={
        confirming ? (
          <View style={{ gap: tokens.space[3] }}>
            <T size={14}>{`Finish with ${total - done} unchecked? They stay as they are.`}</T>
            <ButtonRow>
              <Button label="Cancel" variant="secondary" onPress={() => setConfirming(false)} />
              <Button label="Finish" onPress={finish} />
            </ButtonRow>
          </View>
        ) : (
          <ButtonRow>
            <Button
              label="+ Add batch"
              variant="secondary"
              onPress={() => router.push(`/intake/manual?categoryId=${category.id}`)}
            />
            <Button
              label="Finish check"
              onPress={() => (done < total ? setConfirming(true) : finish())}
            />
          </ButtonRow>
        )
      }
    >
      <ProgressBar value={total ? done / total : 0} />
      {total === 0 ? <EmptyState title="No stock in this category" /> : null}
      {groups.map((g) => (
        <View key={g}>
          <SectionHeader title={g} />
          <Card>
            {rows
              .filter((r) => r.company === g)
              .map(({ batch: b, name }) => {
                const expired = batchStatus(b.expiry, today, shop.alertDays) === 'expired';
                const ticked = !!ticks[b.id] && edits[b.id] === undefined;
                return (
                  <View
                    key={b.id}
                    testID={`check-row-${b.batchNo}`}
                    style={{
                      minHeight: tokens.row,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: tokens.space[2],
                      paddingHorizontal: tokens.space[4],
                      paddingVertical: tokens.space[2],
                      borderBottomWidth: 1,
                      borderBottomColor: tokens.color.rule,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <T size={16} weight="medium" numberOfLines={1}>
                        {name}
                      </T>
                      <T size={12} color={tokens.color.muted} numberOfLines={1}>
                        {`${b.batchNo} · `}
                        {expired ? (
                          <T size={12} color={tokens.color.expired}>
                            {`expired ${formatExpiry(b.expiry)}`}
                          </T>
                        ) : (
                          `exp ${formatExpiry(b.expiry)}`
                        )}
                      </T>
                    </View>
                    <Stepper
                      value={edits[b.id] ?? b.qty}
                      onChange={(n) => setEdits((e) => ({ ...e, [b.id]: n }))}
                    />
                    <IconButton
                      icon="tick"
                      label={`Count matches, ${b.batchNo}`}
                      selected={ticked}
                      onPress={() => void (ticked || mark(b))}
                    />
                  </View>
                );
              })}
          </Card>
        </View>
      ))}
    </Screen>
  );
}
