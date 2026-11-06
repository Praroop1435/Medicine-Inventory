import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { draftIssues, type DraftBatch, type DraftField } from '@/domain/draft';
import { formatExpiry, parseExpiry } from '@/domain/expiry';
import { UNITS } from '@/domain/types';
import { useInventory } from '@/features/shared/hooks/useInventory';
import { Card, Chip, ChipRow, Field, IconButton, KeyValueRow, Pill, T, tokens } from '@/ui';
import type { DraftPatch } from '../IntakeContext';
import { MedicineAutocomplete } from './MedicineAutocomplete';

const NOUN: Record<DraftField, string> = {
  medicineName: 'name',
  companyName: 'company',
  batchNo: 'batch',
  expiry: 'expiry',
  qty: 'quantity',
  categoryId: 'category',
  unit: 'unit',
};
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** "10" → 10, "10+1" → 11 (free goods count as stock); anything else → null. */
export function parseQty(t: string): number | null {
  const m = /^\s*(\d+)\s*(?:\+\s*(\d+))?\s*$/.exec(t);
  return m ? Number(m[1]) + Number(m[2] ?? 0) : null;
}

type Props = {
  draft: DraftBatch;
  onChange: (patch: DraftPatch) => void;
  onConfirm: (f: DraftField) => void;
  onRemove?: () => void;
  /** Flag empty required fields amber. Off for a blank manual form. */
  flagMissing?: boolean;
};

/** One intake row, shared by review and manual entry. Remount (key) when the draft is replaced. */
export function ReviewCard({ draft: d, onChange, onConfirm, onRemove, flagMissing = true }: Props) {
  const { categories } = useInventory();
  const [expiryText, setExpiryText] = useState(d.expiry ? formatExpiry(d.expiry) : '');
  const [qtyText, setQtyText] = useState(d.qty === null ? '' : String(d.qty));
  const issues = draftIssues(d);
  const matched = d.matchedMedicineId !== null;

  const flag = (f: DraftField, text: string): string | undefined => {
    if (d.uncertain.includes(f)) return `Check ${NOUN[f]}`;
    if (!issues.includes(f)) return undefined;
    if (text.trim()) return `Check ${NOUN[f]}`;
    return flagMissing ? `Add ${NOUN[f]}` : undefined;
  };
  // An uncertain field gets an explicit "looks right" tick beside it.
  const confirmable = (f: DraftField, node: ReactNode) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space[2] }}>
      <View style={{ flex: 1 }}>{node}</View>
      {d.uncertain.includes(f) ? (
        <IconButton icon="tick" label={`Looks right: ${NOUN[f]}`} onPress={() => onConfirm(f)} />
      ) : null}
    </View>
  );
  const input = (f: DraftField, label: string, value: string, set: (t: string) => void) => {
    const msg = flag(f, value);
    return confirmable(
      f,
      <Field
        label={label}
        value={value}
        onChangeText={set}
        uncertain={!!msg}
        uncertainLabel={msg}
      />,
    );
  };
  const picker = (label: string, f: DraftField, chips: ReactNode) => (
    <View style={{ gap: tokens.space[1] }}>
      <T size={12} weight="medium" color={flag(f, '') ? tokens.color.soon : tokens.color.muted}>
        {label}
      </T>
      <ChipRow>{chips}</ChipRow>
    </View>
  );

  return (
    <View testID="review-card">
      <Card>
        <View style={{ padding: tokens.space[4], gap: tokens.space[3] }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: tokens.space[2] }}>
            <View style={{ flex: 1 }}>
              {confirmable(
                'medicineName',
                <MedicineAutocomplete
                  value={d.medicineName}
                  matched={matched}
                  onChangeText={(t) => onChange({ medicineName: t })}
                  onPick={(m) => onChange({ medicineName: m.name })}
                  uncertainLabel={flag('medicineName', d.medicineName)}
                />,
              )}
            </View>
            {onRemove ? (
              <IconButton
                icon="close"
                label={`Remove ${d.medicineName.trim() || 'item'}`}
                onPress={onRemove}
              />
            ) : null}
          </View>
          {matched ? (
            <View>
              <KeyValueRow
                label="Category"
                value={categories.find((c) => c.id === d.categoryId)?.name ?? ''}
              />
              <KeyValueRow label="Company" value={d.companyName} />
              <KeyValueRow label="Unit" value={d.unit ? cap(d.unit) : ''} />
            </View>
          ) : (
            <>
              {d.medicineName.trim() ? <Pill label="New" /> : null}
              {input('companyName', 'Company', d.companyName, (t) => onChange({ companyName: t }))}
              {picker(
                'Category',
                'categoryId',
                [...categories]
                  .sort((a, b) => a.order - b.order)
                  .map((c) => (
                    <Chip
                      key={c.id}
                      label={c.name}
                      selected={d.categoryId === c.id}
                      onPress={() => onChange({ categoryId: c.id })}
                    />
                  )),
              )}
              {picker(
                'Unit',
                'unit',
                UNITS.map((u) => (
                  <Chip
                    key={u}
                    label={cap(u)}
                    selected={d.unit === u}
                    onPress={() => onChange({ unit: u })}
                  />
                )),
              )}
            </>
          )}
          {input('batchNo', 'Batch', d.batchNo, (t) => onChange({ batchNo: t }))}
          {input('expiry', 'Expiry', expiryText, (t) => {
            setExpiryText(t);
            onChange({ expiry: parseExpiry(t) });
          })}
          {input('qty', 'Quantity', qtyText, (t) => {
            setQtyText(t);
            onChange({ qty: parseQty(t) });
          })}
        </View>
      </Card>
    </View>
  );
}
