import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { FlatList, View } from 'react-native';
import { canSave, isFuzzyMatch, mergeTarget, type DraftBatch } from '@/domain/draft';
import { expiryDoubt } from '@/domain/expiry';
import { pathLabel, walk } from '@/domain/tree';
import { shopUnits, type Batch } from '@/domain/types';
import { useInventory } from '@/features/shared/hooks/useInventory';
import { useShop } from '@/features/shared/hooks/useShop';
import { useToday } from '@/features/shared/hooks/useToday';
import { errorCopy, useToast } from '@/features/shared/Toast';
import { Button, Card, EmptyState, ProgressBar, Screen, Select, T, tokens } from '@/ui';
import { ReviewCard } from '../components/ReviewCard';
import { ReviewRow, rowState } from '../components/ReviewRow';
import { useIntake } from '../IntakeContext';

const items = (n: number) => `${n} item${n === 1 ? '' : 's'}`;
const rows = (n: number) => `${n} more row${n === 1 ? '' : 's'}`;
const TITLE: Record<DraftBatch['source'], string> = {
  scan: 'Check bill',
  voice: 'Check what you said',
  manual: 'Add stock',
  bulk: 'Check import',
};
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** Every intake path ends here: nothing saves until each row is confirmed. Counts rows, not fields. */
export function ReviewScreen() {
  const { drafts, bill, update, confirm, confirmRow, fillNew, remove, unmatch, save } = useIntake();
  const { categories, medicines, batches } = useInventory();
  const shop = useShop();
  const today = useToday();
  const medicinesById = useMemo(() => new Map(medicines.map((m) => [m.id, m])), [medicines]);
  const batchesByMedicine = useMemo(() => {
    const out = new Map<string, Batch[]>();
    for (const b of batches) out.set(b.medicineId, [...(out.get(b.medicineId) ?? []), b]);
    return out;
  }, [batches]);
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  // One row open for editing at a time; the rest stay compact.
  const [open, setOpen] = useState<string | null>(null);
  // A second tap can land before the disabled state renders; a double save doubles the stock.
  const inFlight = useRef(false);
  const n = drafts.length;
  const confirmed = drafts.filter((d) => rowState(d) === 'ok').length;
  const left = n - confirmed;
  const needHome = drafts.filter((d) => !d.matchedMedicineId && (!d.categoryId || !d.unit));

  const onSave = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    try {
      await save();
      toast(`Saved ${items(n)}`);
      // Home, not back to the camera or voice screen the rows came from.
      router.dismissTo('/');
    } catch (e) {
      toast(errorCopy(e, "Couldn't save. Check the connection and try again."));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <Screen
      list={n > 0}
      back="Back"
      title={TITLE[drafts[0]?.source ?? 'scan']}
      meta={bill ? `${bill.supplier} · Bill #${bill.billNo} · ${bill.billDate}` : undefined}
      footer={
        n ? (
          <Button
            full
            label={left ? `Confirm ${rows(left)}` : `Save ${items(n)}`}
            disabled={saving || !canSave(drafts)}
            onPress={onSave}
          />
        ) : undefined
      }
    >
      {n ? (
        <FlatList
          data={drafts}
          keyExtractor={(d) => d.key}
          keyboardShouldPersistTaps="handled"
          // Rows for the whole of a typical bill on the first frame.
          initialNumToRender={20}
          contentContainerStyle={{ gap: tokens.space[3], paddingBottom: tokens.space[6] }}
          ListHeaderComponent={
            <View style={{ gap: tokens.space[3] }}>
              <View style={{ gap: tokens.space[2] }}>
                <T size={14} color={tokens.color.muted}>{`${confirmed} of ${n} confirmed`}</T>
                <ProgressBar value={confirmed / n} />
              </View>
              {needHome.length >= 2 ? (
                <Card>
                  <View
                    testID="set-for-all"
                    style={{ padding: tokens.space[4], gap: tokens.space[3] }}
                  >
                    <View style={{ gap: tokens.space[1] }}>
                      <T size={16} weight="semibold">
                        {`${needHome.length} new medicines need a folder and unit`}
                      </T>
                      <T size={12} color={tokens.color.muted}>
                        Sets each one that has none yet. You can still change a row on its own.
                      </T>
                    </View>
                    <Select
                      label="Folder for all"
                      placeholder="Pick a folder"
                      options={walk(categories).map((c) => ({
                        id: c.id,
                        label: pathLabel(categories, c.id),
                      }))}
                      selected={null}
                      onSelect={(id) => fillNew({ categoryId: id })}
                    />
                    <Select
                      label="Unit for all"
                      placeholder="Pick a unit"
                      options={shopUnits(shop).map((u) => ({ id: u, label: cap(u) }))}
                      selected={null}
                      onSelect={(u) => fillNew({ unit: u })}
                    />
                  </View>
                </Card>
              ) : null}
            </View>
          }
          renderItem={({ item: d }) => {
            if (open === d.key)
              return (
                <ReviewCard
                  draft={d}
                  onChange={(p) => update(d.key, p)}
                  onConfirm={(f) => confirm(d.key, f)}
                  onRemove={() => remove(d.key)}
                  onDone={() => setOpen(null)}
                  onUnmatch={() => unmatch(d.key)}
                />
              );
            const m = d.matchedMedicineId ? medicinesById.get(d.matchedMedicineId) : undefined;
            return (
              <ReviewRow
                draft={d}
                onOpen={() => setOpen(d.key)}
                onConfirm={() => confirmRow(d.key)}
                matchName={m && isFuzzyMatch(d.medicineName, m) ? m.name : undefined}
                mergesInto={m && mergeTarget(batchesByMedicine.get(m.id) ?? [], m.id, d)?.batchNo}
                expiry={d.expiry && expiryDoubt(d.expiry, today)}
              />
            );
          }}
        />
      ) : (
        <EmptyState icon="clipboard" title="Nothing to check" body="Scan a bill or type stock in.">
          <Button label="Type stock in" full onPress={() => router.replace('/intake/manual')} />
        </EmptyState>
      )}
    </Screen>
  );
}
