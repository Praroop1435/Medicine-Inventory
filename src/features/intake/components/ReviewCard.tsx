import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { draftIssues, type DraftBatch, type DraftField } from '@/domain/draft';
import { formatExpiry, parseExpiry } from '@/domain/expiry';
import { pathLabel, walk } from '@/domain/tree';
import { shopUnits } from '@/domain/types';
import { useRepos } from '@/data/RepoContext';
import { useSession } from '@/features/onboarding/SessionContext';
import { useShop } from '@/features/shared/hooks/useShop';
import { useToast } from '@/features/shared/Toast';
import { useInventory } from '@/features/shared/hooks/useInventory';
import { CategoryEditor } from '@/features/stock/components/CategoryEditor';
import {
  Button,
  ButtonRow,
  Card,
  Chip,
  ChipRow,
  Field,
  IconButton,
  KeyValueRow,
  Pill,
  T,
  tokens,
} from '@/ui';
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
      toast(e instanceof Error ? e.message : 'Something went wrong');
    }
  };
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
                value={d.categoryId ? pathLabel(categories, d.categoryId) : ''}
              />
              <KeyValueRow label="Company" value={d.companyName} />
              <KeyValueRow label="Unit" value={d.unit ? cap(d.unit) : ''} />
            </View>
          ) : (
            <>
              {d.medicineName.trim() ? <Pill label="New" /> : null}
              {input('companyName', 'Company', d.companyName, (t) => onChange({ companyName: t }))}
              {picker('Category', 'categoryId', [
                ...walk(categories).map((c) => (
                  <Chip
                    key={c.id}
                    label={pathLabel(categories, c.id)}
                    selected={d.categoryId === c.id}
                    onPress={() => onChange({ categoryId: c.id })}
                  />
                )),
                <Chip key="+" label="+ New folder" onPress={() => setAddingFolder(true)} />,
              ])}
              {addingFolder ? (
                // New folders from intake go to the top level; they can be moved later in Stock.
                <CategoryEditor
                  onDone={(id) => {
                    setAddingFolder(false);
                    if (id) onChange({ categoryId: id });
                  }}
                />
              ) : null}
              {picker('Unit', 'unit', [
                ...shopUnits(shop).map((u) => (
                  <Chip
                    key={u}
                    label={cap(u)}
                    selected={d.unit === u}
                    onPress={() => onChange({ unit: u })}
                  />
                )),
                <Chip key="+" label="+ Add unit" onPress={() => setNewUnit('')} />,
              ])}
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
