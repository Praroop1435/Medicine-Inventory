import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { canSave, draftIssues, type DraftBatch } from '@/domain/draft';
import { useToast } from '@/features/shared/Toast';
import { Button, EmptyState, Screen, T, tokens } from '@/ui';
import { ReviewCard } from '../components/ReviewCard';
import { useIntake } from '../IntakeContext';

const items = (n: number) => `${n} item${n === 1 ? '' : 's'}`;
const TITLE: Record<DraftBatch['source'], string> = {
  scan: 'Check bill',
  voice: 'Check what you said',
  manual: 'Add stock',
  bulk: 'Check import',
};

/** Every intake path ends here: nothing saves until each amber field is confirmed or edited. */
export function ReviewScreen() {
  const { drafts, bill, update, confirm, remove, save } = useIntake();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  // A second tap can land before the disabled state renders; a double save doubles the stock.
  const inFlight = useRef(false);
  const flagged = drafts.map((d) => new Set([...d.uncertain, ...draftIssues(d)]).size);
  const fields = flagged.reduce((a, b) => a + b, 0);
  const rows = flagged.filter((x) => x > 0).length;
  const n = drafts.length;

  const onSave = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    try {
      await save();
      toast(`Saved ${items(n)}`);
      router.back();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save. Check the connection and try again.");
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <Screen
      back="Back"
      title={TITLE[drafts[0]?.source ?? 'scan']}
      meta={bill ? `${bill.supplier} · Bill #${bill.billNo} · ${bill.billDate}` : undefined}
      footer={
        n ? (
          <Button
            full
            label={
              fields
                ? `Confirm ${fields} field${fields === 1 ? '' : 's'} to save`
                : `Save ${items(n)}`
            }
            disabled={saving || !canSave(drafts)}
            onPress={onSave}
          />
        ) : undefined
      }
    >
      {n ? (
        <View style={{ gap: tokens.space[3] }}>
          <T size={14} color={tokens.color.muted}>
            {`${items(n)} read${rows ? ` · ${rows} need${rows === 1 ? 's' : ''} a look` : ''}`}
          </T>
          {drafts.map((d) => (
            <ReviewCard
              key={d.key}
              draft={d}
              onChange={(p) => update(d.key, p)}
              onConfirm={(f) => confirm(d.key, f)}
              onRemove={() => remove(d.key)}
            />
          ))}
        </View>
      ) : (
        <EmptyState icon="clipboard" title="Nothing to check" body="Scan a bill or type stock in.">
          <Button label="Type stock in" full onPress={() => router.replace('/intake/manual')} />
        </EmptyState>
      )}
    </Screen>
  );
}
