import { searchInventory } from '../search';
import type { Batch, Company, Medicine } from '../types';

const co: Company[] = [
  { id: 'c1', name: 'Alembic' },
  { id: 'c2', name: 'Cipla' },
];
const med = (id: string, name: string, companyId: string): Medicine => ({
  id,
  name,
  companyId,
  categoryId: 'k',
  unit: 'strip',
});
const meds = [
  med('m1', 'Azithral 500', 'c1'),
  med('m2', 'Zithromax', 'c2'),
  med('m3', 'Amoxil', 'c2'),
];
const batch = (
  id: string,
  medicineId: string,
  batchNo: string,
  qty: number,
  status: Batch['status'] = 'active',
): Batch => ({
  id,
  medicineId,
  batchNo,
  qty,
  status,
  expiry: { year: 2027, month: 1 },
  billId: null,
  createdAt: 1,
});
const bs = [
  batch('b1', 'm1', 'AZ-77', 3),
  batch('b2', 'm1', 'AZ-78', 2),
  batch('b3', 'm3', 'XQ9', 1),
  batch('b4', 'm2', 'GONE5', 4, 'returned'),
];
const s = (q: string) => searchInventory(q, meds, co, bs);

describe('searchInventory', () => {
  it('matches the medicine name and totals live qty in the subtitle', () => {
    expect(s('azi')).toEqual([
      { medicineId: 'm1', title: 'Azithral 500', subtitle: 'Alembic · 5 strips' },
    ]);
  });
  it('matches the company', () => {
    expect(s('cipla').map((r) => r.medicineId)).toEqual(['m3', 'm2']);
  });
  it('matches a live batch number and reports it', () => {
    expect(s('xq9')).toEqual([
      { medicineId: 'm3', title: 'Amoxil', subtitle: 'Cipla · 1 strip', matchedBatchNo: 'XQ9' },
    ]);
  });
  it('ignores batch numbers of returned batches', () => {
    expect(s('gone5')).toEqual([]);
  });
  it('is case and punctuation insensitive', () => {
    expect(s('AZ 77').map((r) => r.medicineId)).toEqual(['m1']);
    expect(s('azithral-500').map((r) => r.medicineId)).toEqual(['m1']);
  });
  it('returns nothing under 2 non-space characters', () => {
    expect(s('a')).toEqual([]);
    expect(s(' a ')).toEqual([]);
    expect(s('')).toEqual([]);
  });
  it('returns one result per medicine', () => {
    expect(s('az').filter((r) => r.medicineId === 'm1')).toHaveLength(1);
  });
  it('lists name-prefix matches first, then others alphabetically', () => {
    // "zi": Zithromax (prefix) before Azithral (contains)
    expect(s('zi').map((r) => r.medicineId)).toEqual(['m2', 'm1']);
  });
});
