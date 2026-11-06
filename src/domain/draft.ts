import { findMedicineMatch } from './matching';
import type { Company, Medicine, Unit, YearMonth } from './types';

export type DraftField =
  'medicineName' | 'companyName' | 'batchNo' | 'expiry' | 'qty' | 'categoryId' | 'unit';

export type DraftBatch = {
  key: string;
  source: 'scan' | 'voice' | 'manual' | 'bulk';
  medicineName: string;
  companyName: string;
  categoryId: string | null;
  unit: Unit | null;
  batchNo: string;
  expiry: YearMonth | null;
  qty: number | null;
  matchedMedicineId: string | null;
  uncertain: DraftField[];
  /** Pack text from a scanned bill ("1*30ML"), stored on a newly created medicine. */
  packInfo?: string;
};

let counter = 0;

export function emptyDraft(source: DraftBatch['source']): DraftBatch {
  return {
    key: `${Date.now().toString(36)}-${(counter++).toString(36)}`,
    source,
    medicineName: '',
    companyName: '',
    categoryId: null,
    unit: null,
    batchNo: '',
    expiry: null,
    qty: null,
    matchedMedicineId: null,
    uncertain: [],
  };
}

export function applyMatch(d: DraftBatch, medicines: Medicine[], companies: Company[]): DraftBatch {
  const m = findMedicineMatch(d.medicineName, medicines);
  if (!m) return { ...d, matchedMedicineId: null };
  return {
    ...d,
    matchedMedicineId: m.id,
    companyName: companies.find((c) => c.id === m.companyId)?.name ?? d.companyName,
    categoryId: m.categoryId,
    unit: m.unit,
  };
}

export function draftIssues(d: DraftBatch): DraftField[] {
  const out: DraftField[] = [];
  const matched = d.matchedMedicineId !== null;
  if (!d.medicineName.trim()) out.push('medicineName');
  if (!matched && !d.companyName.trim()) out.push('companyName');
  if (!d.batchNo.trim()) out.push('batchNo');
  if (!d.expiry) out.push('expiry');
  if (d.qty === null || !Number.isInteger(d.qty) || d.qty < 1) out.push('qty');
  if (!matched && !d.categoryId) out.push('categoryId');
  if (!matched && !d.unit) out.push('unit');
  return out;
}

export const confirmField = (d: DraftBatch, f: DraftField): DraftBatch => ({
  ...d,
  uncertain: d.uncertain.filter((u) => u !== f),
});

export const canSave = (ds: DraftBatch[]): boolean =>
  ds.length > 0 && ds.every((d) => d.uncertain.length === 0 && draftIssues(d).length === 0);
