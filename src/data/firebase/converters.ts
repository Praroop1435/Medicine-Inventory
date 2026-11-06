import type { Batch, Category, Device, YearMonth } from '@/domain/types';

// Pure mapping between domain records and Firestore documents. Doc ids are never stored as fields.

export const toExpiryKey = ({ year, month }: YearMonth): number => year * 100 + month;
export const fromExpiryKey = (k: number): YearMonth => ({
  year: Math.floor(k / 100),
  month: k % 100,
});

export function withoutId<T extends { id: string }>(x: T): Omit<T, 'id'> {
  const { id, ...rest } = x;
  void id;
  return rest;
}
export const withId = <T>(id: string, data: object): T => ({ ...data, id }) as T;

export type BatchDoc = Omit<Batch, 'id' | 'expiry'> & { expiryKey: number };

export function batchToDoc(b: Batch): BatchDoc {
  const { expiry, ...rest } = withoutId(b);
  return { ...rest, expiryKey: toExpiryKey(expiry) };
}
export function batchFromDoc(id: string, d: BatchDoc): Batch {
  const { expiryKey, ...rest } = d;
  return { ...rest, id, expiry: fromExpiryKey(expiryKey) };
}

// Device docs also carry the joinSecret used to pass the join rule; it is not part of Device.
export type DeviceDoc = Omit<Device, 'id'> & { joinSecret: string };
export const deviceFromDoc = (id: string, d: DeviceDoc): Device => ({
  id,
  displayName: d.displayName,
  joinedAt: d.joinedAt,
  removed: d.removed,
});

// Category docs written before folders (§11.1) have no parentId: they are top level. No migration write.
export const categoryFromDoc = (id: string, d: object): Category =>
  ({ parentId: null, ...d, id }) as Category;
