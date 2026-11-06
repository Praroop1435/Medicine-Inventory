import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { draftIssues, isFuzzyMatch, type DraftBatch, type DraftField } from '@/domain/draft';
import { daysUntilExpiry, formatExpiry, parseExpiry } from '@/domain/expiry';
import { pathLabel, walk } from '@/domain/tree';
import { shopUnits } from '@/domain/types';
import { useRepos } from '@/data/RepoContext';
import { useSession } from '@/features/onboarding/SessionContext';
import { useShop } from '@/features/shared/hooks/useShop';
import { useToday } from '@/features/shared/hooks/useToday';
import { errorCopy, useToast } from '@/features/shared/Toast';
import { useInventory } from '@/features/shared/hooks/useInventory';
import { CategoryEditor } from '@/features/stock/components/CategoryEditor';
import { Button, ButtonRow, Card, Field, IconButton, KeyValueRow, Select, T, tokens } from '@/ui';
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

/**
 * Typing on a number pad: digits become "MM/YY" (or MM/YYYY) with the slash added after the
 * month. Anything with letters (e.g. "Nov 2026" from a scan) is left for parseExpiry.
 */
export function typeExpiry(next: string, prev: string): string {
  if (!/^[\d/\s]*$/.test(next)) return next;
  const d = next.replace(/\D/g, '').slice(0, 6);
  if (d.length > 2) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return d.length === 2 && next.length > prev.length ? `${d}/` : d;
}
const mmYy = ({ year, month }: { year: number; month: number }) =>
  `${String(month).padStart(2, '0')}/${String(year).slice(2)}`;

type Props = {
  draft: DraftBatch;
  onChange: (patch: DraftPatch) => void;
  onConfirm: (f: DraftField) => void;
  onRemove?: () => void;
  /** Flag empty required fields amber. Off for a blank manual form. */
  flagMissing?: boolean;
  /** Review: collapses the row back into its summary card. */
  onDone?: () => void;
  /** Turns down a near-name match: the row becomes a new medicine under the name as read. */
  onUnmatch?: () => void;
};

/** One intake row, shared by review and manual entry. Remount (key) when the draft is replaced. */
export function ReviewCard({
  draft: d,
  onChange,
  onConfirm,
  onRemove,
  flagMissing = true,
  onDone,
  onUnmatch,
}: Props) {
  const { categories, medicines } = useInventory();
  const [expiryText, setExpiryText] = useState(d.expiry ? mmYy(d.expiry) : '');
  const today = useToday();
  const [qtyText, setQtyText] = useState(d.qty === null ? '' : String(d.qty));
  const [addingFolder, setAddingFolder] = useState(false);
  const [newUnit, setNewUnit] = useState<string | null>(null);
  const shop = useShop();
  const repos = useRepos().shop;
  const session = useSession().session;
  const toast = useToast();
  const addUnit = async () => {
    if (!session || !newUnit?.trim()) return;
    try {
      await repos.addUnit(session.shopId, newUnit, session.deviceId);
      onChange({ unit: newUnit.trim().toLowerCase() });
      setNewUnit(null);
    } catch (e) {
      toast(errorCopy(e, "Couldn't save. Check the connection and try again."));
    }
  };
  const issues = draftIssues(d);
  const matched = d.matchedMedicineId !== null;
  const match = matched ? medicines.find((m) => m.id === d.matchedMedicineId) : undefined;
  const guessed = match && isFuzzyMatch(d.medicineName, match) ? match : undefined;

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
  const input = (
    f: DraftField,
    label: string,
    value: string,
    set: (t: string) => void,
    extra?: Partial<Parameters<typeof Field>[0]>,
  ) => {
    const msg = flag(f, value);
    return confirmable(
      f,
      <Field
        label={label}
        value={value}
        onChangeText={set}
        uncertain={!!msg}
        uncertainLabel={msg}
        {...extra}
      />,
    );
  };
  const picker = (
    label: string,
    f: 'categoryId' | 'unit',
    options: { id: string; label: string }[],
    action: { label: string; onPress: () => void },
  ) => {
    const msg = flag(f, '');
    return (
      <Select
        label={label}
        options={options}
        selected={d[f]}
        onSelect={(id) => onChange({ [f]: id })}
        placeholder={f === 'categoryId' ? 'Pick a folder' : 'Pick a unit'}
        uncertain={!!msg}
        uncertainLabel={msg}
        action={action}
      />
    );
  };

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
          {guessed ? (
            <View style={{ gap: tokens.space[2] }}>
              <T size={12} color={tokens.color.soon}>{`Matches existing ${guessed.name}`}</T>
              {onUnmatch ? (
                <Button label="New medicine instead" variant="secondary" onPress={onUnmatch} />
              ) : null}
            </View>
          ) : null}
          {matched ? (
            <View>
              <KeyValueRow
                label="Category"
                value={d.categoryId ? pathLabel(categories, d.categoryId) : ''}
              />
              <KeyValueRow label="Company" value={d.companyName} />
              <KeyValueRow label="Unit" value={d.unit ? cap(d.unit) : ''} />
            </View>
          ) : (
            <>
              {d.medicineName.trim() ? (
                <T size={12} color={tokens.color.muted}>
                  New medicine · pick category and unit
                </T>
              ) : null}
              {input('companyName', 'Company', d.companyName, (t) => onChange({ companyName: t }), {
                placeholder: 'e.g. Alembic',
              })}
              {picker(
                'Category',
                'categoryId',
                walk(categories).map((c) => ({ id: c.id, label: pathLabel(categories, c.id) })),
                { label: '+ New folder', onPress: () => setAddingFolder(true) },
              )}
              {addingFolder ? (
                // New folders from intake go to the top level; they can be moved later in Stock.
                <CategoryEditor
                  onDone={(id) => {
                    setAddingFolder(false);
                    if (id) onChange({ categoryId: id });
                  }}
                />
              ) : null}
              {picker(
                'Unit',
                'unit',
                shopUnits(shop).map((u) => ({ id: u, label: cap(u) })),
                { label: '+ Add unit', onPress: () => setNewUnit('') },
              )}
              {newUnit !== null ? (
                <View style={{ gap: tokens.space[3] }}>
                  <Field label="New unit" value={newUnit} onChangeText={setNewUnit} />
                  <ButtonRow>
                    <Button label="Cancel" variant="secondary" onPress={() => setNewUnit(null)} />
                    <Button label="Add" disabled={!newUnit.trim()} onPress={addUnit} />
                  </ButtonRow>
                </View>
              ) : null}
            </>
          )}
          {input('batchNo', 'Batch', d.batchNo, (t) => onChange({ batchNo: t }), {
            placeholder: 'As printed on the strip',
          })}
          {input(
            'expiry',
            'Expiry',
            expiryText,
            (t) => {
              const next = typeExpiry(t, expiryText);
              setExpiryText(next);
              onChange({ expiry: parseExpiry(next) });
            },
            {
              placeholder: 'MM/YY',
              keyboardType: 'number-pad',
              // How the text was read, so "11/26" visibly means Nov 2026.
              hint: d.expiry
                ? daysUntilExpiry(d.expiry, today) < 0
                  ? `${formatExpiry(d.expiry)} · Already expired`
                  : formatExpiry(d.expiry)
                : undefined,
              hintTone: d.expiry && daysUntilExpiry(d.expiry, today) < 0 ? 'expired' : 'muted',
            },
          )}
          {input(
            'qty',
            'Quantity',
            qtyText,
            (t) => {
              setQtyText(t);
              onChange({ qty: parseQty(t) });
            },
            { keyboardType: 'number-pad', placeholder: 'e.g. 10' },
          )}
          {onDone ? <Button label="Done" variant="secondary" full onPress={onDone} /> : null}
        </View>
      </Card>
    </View>
  );
}
