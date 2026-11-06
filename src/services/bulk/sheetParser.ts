import { emptyDraft, type DraftBatch } from '@/domain/draft';
import { parseExpiry } from '@/domain/expiry';
import { normalizeName } from '@/domain/matching';
import { UNITS, type Category, type Unit } from '@/domain/types';

export const TEMPLATE_HEADERS = [
  'category',
  'company',
  'medicine',
  'unit',
  'batch',
  'expiry',
  'qty',
] as const;

export type SheetError = { row: number; message: string };

const parseQty = (s: string): number | null => {
  const m = /^(\d+)(?:\s*\+\s*(\d+))?$/.exec(s.trim());
  const n = m ? Number(m[1]) + Number(m[2] ?? 0) : 0;
  return n >= 1 ? n : null;
};

const parseUnit = (s: string): Unit | null => {
  const t = s.trim().toLowerCase();
  return UNITS.find((u) => t === u || t === `${u}s` || t === `${u}es`) ?? null;
};

/** `rows[0]` is the header; error rows are 1-based spreadsheet rows. */
export function parseSheetRows(
  rows: string[][],
  categories: Category[],
): { drafts: DraftBatch[]; errors: SheetError[] } {
  const head = (rows[0] ?? []).map((h) => h.trim().toLowerCase());
  const missing = TEMPLATE_HEADERS.filter((h) => !head.includes(h));
  if (missing.length)
    return {
      drafts: [],
      errors: missing.map((h) => ({ row: 1, message: `Missing column: ${h}` })),
    };

  const drafts: DraftBatch[] = [];
  const errors: SheetError[] = [];
  rows.slice(1).forEach((r, i) => {
    const cell = (h: string) => (r[head.indexOf(h)] ?? '').trim();
    if (r.every((c) => !c.trim())) return;
    const row = i + 2;
    const fail = (message: string) => errors.push({ row, message });
    const unit = parseUnit(cell('unit'));
    const qty = parseQty(cell('qty'));
    const expiry = parseExpiry(cell('expiry'));
    if (!cell('medicine')) return fail('Medicine is blank');
    if (!cell('batch')) return fail('Batch is blank');
    if (!unit) return fail('Unit not recognised');
    if (qty === null) return fail('Quantity must be a whole number, 1 or more');
    if (!expiry) return fail('Expiry not readable');
    const cat = normalizeName(cell('category'));
    drafts.push({
      ...emptyDraft('bulk'),
      medicineName: cell('medicine'),
      companyName: cell('company'),
      categoryId: (cat && categories.find((c) => normalizeName(c.name) === cat)?.id) || null,
      unit,
      batchNo: cell('batch'),
      expiry,
      qty,
    });
  });
  return { drafts, errors };
}
