import { pickBatchForSale } from '../fefo';
import type { Batch } from '../types';

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

test('picks earliest expiry, skipping qty 0 and returned', () => {
  const az88 = makeBatch({ batchNo: 'AZ88', qty: 2, expiry: { year: 2026, month: 11 } });
  const az94 = makeBatch({ batchNo: 'AZ94', qty: 3, expiry: { year: 2027, month: 8 } });
  const empty = makeBatch({ qty: 0, expiry: { year: 2026, month: 1 } });
  const ret = makeBatch({ status: 'returned', expiry: { year: 2026, month: 1 } });
  expect(pickBatchForSale([az94, empty, ret, az88])).toBe(az88);
});

test('tie broken by older createdAt', () => {
  const a = makeBatch({ createdAt: 5 });
  const b = makeBatch({ createdAt: 2 });
  expect(pickBatchForSale([a, b])).toBe(b);
});

test('null when nothing live', () => {
  expect(pickBatchForSale([makeBatch({ qty: 0 }), makeBatch({ status: 'removed' })])).toBeNull();
  expect(pickBatchForSale([])).toBeNull();
});
