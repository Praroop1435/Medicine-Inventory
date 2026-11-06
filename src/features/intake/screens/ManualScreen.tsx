import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { canSave, confirmField, emptyDraft, type DraftBatch } from '@/domain/draft';
import type { Medicine } from '@/domain/types';
import { useInventory } from '@/features/shared/hooks/useInventory';
import { useToast } from '@/features/shared/Toast';
import { Button, ButtonRow, Screen, Skeleton } from '@/ui';
import { ReviewCard } from '../components/ReviewCard';
import { editDraft, useSaveDrafts } from '../IntakeContext';

/** Type stock in by hand, one row at a time; `?medicineId=` starts from that medicine, `?categoryId=` presets the category. */
export function ManualScreen() {
  const { medicineId, categoryId } = useLocalSearchParams<{
    medicineId?: string;
    categoryId?: string;
  }>();
  const { medicines, loading } = useInventory();
  if (loading)
    return (
      <Screen back="Back" title="Add stock">
        <Skeleton />
      </Screen>
    );
  return (
    <ManualForm
      medicine={medicines.find((m) => m.id === medicineId)}
      categoryId={categoryId ?? null}
    />
  );
}

function ManualForm({ medicine, categoryId }: { medicine?: Medicine; categoryId: string | null }) {
  const { medicines, companies } = useInventory();
  const saveDrafts = useSaveDrafts();
  const toast = useToast();
  const edit = (d: DraftBatch, p: Parameters<typeof editDraft>[1]) =>
    editDraft(d, p, medicines, companies);
  const [draft, setDraft] = useState(() =>
    medicine
      ? edit(emptyDraft('manual'), { medicineName: medicine.name })
      : { ...emptyDraft('manual'), categoryId },
  );
  const [saving, setSaving] = useState(false);
  // A second tap can land before the disabled state renders; a double save doubles the stock.
  const inFlight = useRef(false);

  const saveNext = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    try {
      await saveDrafts([draft], null);
      toast(`Saved ${draft.medicineName.trim()}`);
      // Keep what a shelf of the same kind shares.
      const { companyName, categoryId, unit } = draft;
      setDraft({ ...emptyDraft('manual'), companyName, categoryId, unit });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <Screen
      back="Back"
      title="Add stock"
      footer={
        <ButtonRow>
          <Button label="Done" variant="secondary" onPress={() => router.back()} />
          <Button label="Save & next" disabled={saving || !canSave([draft])} onPress={saveNext} />
        </ButtonRow>
      }
    >
      <ReviewCard
        key={draft.key}
        draft={draft}
        flagMissing={false}
        onChange={(p) => setDraft((d) => edit(d, p))}
        onConfirm={(f) => setDraft((d) => confirmField(d, f))}
      />
    </Screen>
  );
}
