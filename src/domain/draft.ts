import { findMedicineMatch, normalizeName } from './matching';
import type { Batch, Company, Medicine, Unit, YearMonth } from './types';

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

/** Ties a draft to this medicine (by id) and takes its company, folder and unit. */
export const fromMedicine = (d: DraftBatch, m: Medicine, companies: Company[]): DraftBatch => ({
  ...d,
  medicineName: d.medicineName || m.name,
  matchedMedicineId: m.id,
  companyName: companies.find((c) => c.id === m.companyId)?.name ?? d.companyName,
  categoryId: m.categoryId,
  unit: m.unit,
});

/** Only a name that differs from the medicine it matched (after normalizing) is a guess. */
export const isFuzzyMatch = (name: string, m: Medicine) =>
  normalizeName(name) !== normalizeName(m.name);

export function applyMatch(d: DraftBatch, medicines: Medicine[], companies: Company[]): DraftBatch {
  const m = findMedicineMatch(d.medicineName, medicines);
  if (!m) return { ...d, matchedMedicineId: null };
  const next = fromMedicine(d, m, companies);
  // A new guess needs a human; re-applying the same match keeps their confirmation.
  const doubt =
    m.id !== d.matchedMedicineId &&
    isFuzzyMatch(d.medicineName, m) &&
    !d.uncertain.includes('medicineName');
  return doubt ? { ...next, uncertain: [...next.uncertain, 'medicineName'] } : next;
}

export const sameBatchNo = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/** The batch a draft adds to instead of making a new row: same medicine, batch no and expiry. */
export const mergeTarget = <B extends Pick<Batch, 'medicineId' | 'batchNo' | 'expiry'>>(
  batches: B[],
  medicineId: string,
  d: Pick<DraftBatch, 'batchNo' | 'expiry'>,
): B | undefined =>
  batches.find(
    (b) =>
      b.medicineId === medicineId &&
      sameBatchNo(b.batchNo, d.batchNo) &&
      b.expiry.year === d.expiry?.year &&
      b.expiry.month === d.expiry?.month,
  );

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
