import type { Batch } from '@/domain/types';
import {
  checkMerge,
  newJoinSecret,
  returnChange,
  sellOneChange,
  setCountChange,
} from '../mutations';

const batch = (o: Partial<Batch> = {}): Batch => ({
  id: 'b1',
  medicineId: 'm1',
  batchNo: 'B1',
  expiry: { year: 2027, month: 6 },
  qty: 2,
  billId: null,
  status: 'active',
  createdAt: 1,
  ...o,
});

describe('stock changes', () => {
  it('sellOne decrements and closes at zero', () => {
    const a = sellOneChange(batch(), 'd1', 5);
    expect(a.batch).toEqual(batch({ qty: 1 }));
    expect(a.event).toEqual({
      id: expect.any(String),
      batchId: 'b1',
      medicineId: 'm1',
      type: 'sold',
      delta: -1,
      deviceId: 'd1',
      at: 5,
    });
    expect(sellOneChange(batch({ qty: 1 }), 'd1', 5).batch).toMatchObject({
      qty: 0,
      status: 'removed',
    });
  });

  it('sellOne rejects empty or non-active batches', () => {
    expect(() => sellOneChange(batch({ qty: 0 }), 'd1', 1)).toThrow(/no stock/);
    expect(() => sellOneChange(batch({ status: 'returned' }), 'd1', 1)).toThrow(/no stock/);
  });

  it('setCount records the delta, closes at zero and validates', () => {
    expect(setCountChange(batch({ qty: 5 }), 3, 'count_fixed', 'd1', 1).event).toMatchObject({
      type: 'count_fixed',
      delta: -2,
    });
    expect(setCountChange(batch(), 0, 'checked', 'd1', 1).batch).toMatchObject({
      qty: 0,
      status: 'removed',
    });
    expect(() => setCountChange(batch(), -1, 'checked', 'd1', 1)).toThrow(/invalid/);
    expect(() => setCountChange(batch(), 1.5, 'checked', 'd1', 1)).toThrow(/invalid/);
    expect(() => setCountChange(batch({ status: 'removed' }), 1, 'checked', 'd1', 1)).toThrow(
      /not active/,
    );
  });

  it('markReturned writes a negative delta for the remaining qty', () => {
    const r = returnChange(batch({ qty: 4 }), 'd1', 1);
    expect(r.batch.status).toBe('returned');
    expect(r.event).toMatchObject({ type: 'returned', delta: -4 });
    expect(() => returnChange(r.batch, 'd1', 1)).toThrow(/not active/);
  });
});

describe('checkMerge', () => {
  const all = [{ id: 'a' }, { id: 'b' }];
  it('rejects same or missing ids', () => {
    expect(() => checkMerge('a', 'a', all)).toThrow(/same/);
    expect(() => checkMerge('a', 'x', all)).toThrow(/not found/);
    expect(() => checkMerge('a', 'b', all)).not.toThrow();
  });
});

it('join secrets are long and distinct', () => {
  const s = newJoinSecret();
  expect(s.length).toBeGreaterThanOrEqual(24);
  expect(newJoinSecret()).not.toBe(s);
});
