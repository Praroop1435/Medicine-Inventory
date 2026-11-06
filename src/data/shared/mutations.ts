import { childrenOf, descendantIds, nextOrder } from '@/domain/tree';
import type { Batch, Category, StockEvent } from '@/domain/types';
import { newId } from '@/lib/ids';

export const CATEGORIES = [
  'Antibiotics',
  'Cough syrups',
  'Pain relief',
  'Balms',
  'Lotions',
  'Eye/ear drops',
  'Tablets (general)',
  'Vitamins',
  'Others',
];
export const DEFAULT_ALERT_DAYS = { first: 90, second: 30 };
export const DEFAULT_NOTIFY_TIME = '09:00';

export const newJoinSecret = () =>
  Array.from({ length: 3 }, () => Math.random().toString(36).slice(2, 10).padEnd(8, '0')).join('');

export const sameBatchNo = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

export function checkMerge(fromId: string, intoId: string, all: { id: string }[]) {
  if (fromId === intoId) throw new Error('cannot merge into the same record');
  if (!all.some((x) => x.id === fromId) || !all.some((x) => x.id === intoId))
    throw new Error('record not found');
}

export function folderName(name: string): string {
  const n = name.trim();
  if (!n) throw new Error('folder name is required');
  return n;
}

/** The only fields a move writes: the new parent and a place at the end of its sibling group. */
export function moveChange(cats: Category[], id: string, parentId: string | null) {
  if (!cats.some((c) => c.id === id)) throw new Error('category not found');
  if (parentId !== null && !cats.some((c) => c.id === parentId))
    throw new Error('category not found');
  if (parentId === id || (parentId !== null && descendantIds(cats, id).includes(parentId)))
    throw new Error('cannot move a folder into itself (cycle)');
  return {
    parentId,
    order: nextOrder(
      cats.filter((c) => c.id !== id),
      parentId,
    ),
  };
}

export function checkDeletable(cats: Category[], medicines: { categoryId: string }[], id: string) {
  if (!cats.some((c) => c.id === id)) throw new Error('category not found');
  if (childrenOf(cats, id).length > 0 || medicines.some((m) => m.categoryId === id))
    throw new Error('folder is not empty');
}

export const eventFor = (
  b: Batch,
  type: StockEvent['type'],
  delta: number,
  deviceId: string,
  at: number,
): StockEvent => ({
  id: newId(),
  batchId: b.id,
  medicineId: b.medicineId,
  type,
  delta,
  deviceId,
  at,
});

export type StockChange = { batch: Batch; event: StockEvent };

const closeAtZero = (qty: number): Batch['status'] => (qty === 0 ? 'removed' : 'active');

export function sellOneChange(b: Batch, deviceId: string, at: number): StockChange {
  if (b.status !== 'active' || b.qty < 1) throw new Error('no stock to sell');
  const batch: Batch = { ...b, qty: b.qty - 1, status: closeAtZero(b.qty - 1) };
  return { batch, event: eventFor(batch, 'sold', -1, deviceId, at) };
}

export function setCountChange(
  b: Batch,
  qty: number,
  type: 'count_fixed' | 'checked',
  deviceId: string,
  at: number,
): StockChange {
  if (!Number.isInteger(qty) || qty < 0) throw new Error('invalid quantity');
  if (b.status !== 'active') throw new Error('batch is not active');
  const batch: Batch = { ...b, qty, status: closeAtZero(qty) };
  return { batch, event: eventFor(batch, type, qty - b.qty, deviceId, at) };
}

export function returnChange(b: Batch, deviceId: string, at: number): StockChange {
  if (b.status !== 'active') throw new Error('batch is not active');
  const batch: Batch = { ...b, status: 'returned' };
  return { batch, event: eventFor(batch, 'returned', -b.qty, deviceId, at) };
}
