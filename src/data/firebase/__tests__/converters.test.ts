import type { Batch, Device } from '@/domain/types';
import {
  batchFromDoc,
  batchToDoc,
  deviceFromDoc,
  fromExpiryKey,
  toExpiryKey,
  withId,
  withoutId,
} from '../converters';

const b: Batch = {
  id: 'b1',
  medicineId: 'm1',
  batchNo: 'B1',
  expiry: { year: 2027, month: 6 },
  qty: 3,
  billId: null,
  status: 'active',
  createdAt: 5,
};

describe('converters', () => {
  it('stores expiry as a sortable YYYYMM number', () => {
    expect(toExpiryKey({ year: 2027, month: 6 })).toBe(202706);
    expect(toExpiryKey({ year: 2026, month: 12 })).toBeLessThan(
      toExpiryKey({ year: 2027, month: 1 }),
    );
    expect(fromExpiryKey(202612)).toEqual({ year: 2026, month: 12 });
  });

  it('round-trips a batch without storing id or expiry', () => {
    const d = batchToDoc(b);
    expect(d).not.toHaveProperty('id');
    expect(d).not.toHaveProperty('expiry');
    expect(d.expiryKey).toBe(202706);
    expect(batchFromDoc('b1', d)).toEqual(b);
  });

  it('drops the join secret from device docs', () => {
    const dev: Device = { id: 'u1', displayName: 'Ravi', joinedAt: 1, removed: false };
    expect(deviceFromDoc('u1', { ...withoutId(dev), joinSecret: 's' })).toEqual(dev);
  });

  it('withId / withoutId are inverses', () => {
    expect(withId('c1', withoutId({ id: 'c1', name: 'Co' }))).toEqual({ id: 'c1', name: 'Co' });
  });
});
