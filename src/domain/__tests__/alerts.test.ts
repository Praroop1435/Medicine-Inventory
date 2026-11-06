import { alertCounts, batchesByStatus, categorySummary, isLive, medicineSummary } from '../alerts';
import type { Batch, Medicine } from '../types';

const today = new Date(2026, 10, 6);
const d = { first: 90, second: 30 };
let n = 0;
const makeBatch = (p: Partial<Batch> = {}): Batch => ({
  id: `b${n++}`,
  medicineId: 'm1',
  batchNo: 'X',
  expiry: { year: 2030, month: 1 },
  qty: 1,
  billId: null,
  status: 'active',
  createdAt: n,
  ...p,
});
const many = (k: number, p: Partial<Batch>) => Array.from({ length: k }, () => makeBatch(p));

const EXPIRED = { year: 2026, month: 9 };
const SOON = { year: 2026, month: 11 };
const WATCH = { year: 2027, month: 1 };

test('alertCounts uses disjoint buckets and ignores dead batches', () => {
  const bs = [
    ...many(3, { expiry: EXPIRED }),
    ...many(5, { expiry: SOON }),
    ...many(14, { expiry: WATCH }),
    ...many(10, {}),
    ...many(2, { expiry: EXPIRED, status: 'returned' }),
    makeBatch({ expiry: EXPIRED, qty: 0 }),
  ];
  expect(alertCounts(bs, today, d)).toEqual({ expired: 3, soon: 5, watch: 14 });
  expect(isLive(makeBatch({ qty: 0 }))).toBe(false);
});

test('batchesByStatus sorts soonest first, tie by createdAt', () => {
  const a = makeBatch({ expiry: { year: 2026, month: 11 }, createdAt: 5 });
  const b = makeBatch({ expiry: { year: 2026, month: 11 }, createdAt: 2 });
  const c = makeBatch({ expiry: { year: 2026, month: 10 }, createdAt: 9 });
  const x = makeBatch({ expiry: { year: 2026, month: 10 }, createdAt: 1 });
  expect(batchesByStatus([a, b, c, x], today, d, 'soon')).toEqual([b, a]);
  expect(batchesByStatus([a, b, c, x], today, d, 'expired')).toEqual([x, c]);
});

test('medicineSummary', () => {
  const bs = [
    makeBatch({ qty: 2, expiry: SOON }),
    makeBatch({ qty: 3, expiry: { year: 2027, month: 8 } }),
    makeBatch({ medicineId: 'other' }),
  ];
  expect(medicineSummary('m1', bs, today, d)).toEqual({ qty: 5, batchCount: 2, next: SOON, worst: 'soon' });
  expect(medicineSummary('zzz', bs, today, d)).toEqual({ qty: 0, batchCount: 0, next: null, worst: null });
});

describe('categorySummary', () => {
  const med = (id: string, categoryId: string): Medicine => ({ id, name: id, categoryId, companyId: 'c', unit: 'box' });
  const meds = [med('m1', 'cat'), med('m2', 'cat'), med('m3', 'other')];
  test('worst and worstCount', () => {
    const bs = [
      makeBatch({ medicineId: 'm1', expiry: EXPIRED, qty: 4 }),
      makeBatch({ medicineId: 'm2', expiry: EXPIRED }),
      makeBatch({ medicineId: 'm2', expiry: SOON }),
      makeBatch({ medicineId: 'm3', expiry: EXPIRED }),
    ];
    expect(categorySummary('cat', meds, bs, today, d)).toEqual({ medicineCount: 2, unitCount: 6, worst: 'expired', worstCount: 2 });
  });
  test('all ok', () => {
    const r = categorySummary('cat', meds, [makeBatch({ medicineId: 'm1' })], today, d);
    expect(r.worst).toBe('ok');
  });
  test('no batches', () => {
    expect(categorySummary('cat', meds, [], today, d)).toMatchObject({ unitCount: 0, worst: null, worstCount: 0 });
  });
});
