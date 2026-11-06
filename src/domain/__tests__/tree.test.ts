import type { Batch, Category, Medicine } from '../types';
import {
  childrenOf,
  descendantIds,
  isDescendant,
  nextOrder,
  pathLabel,
  pathOf,
  rollupSummary,
  walk,
} from '../tree';

const cat = (id: string, parentId: string | null, order = 0): Category => ({
  id,
  name: id[0].toUpperCase() + id.slice(1),
  order,
  lastCheckedAt: null,
  parentId,
});
// syrups › cough › dry, syrups › cold; balms at top level.
const CATS: Category[] = [
  cat('balms', null, 1),
  cat('syrups', null, 0),
  cat('cold', 'syrups', 1),
  cat('cough', 'syrups', 0),
  cat('dry', 'cough', 0),
];

test('childrenOf lists one sibling group by order', () => {
  expect(childrenOf(CATS, null).map((c) => c.id)).toEqual(['syrups', 'balms']);
  expect(childrenOf(CATS, 'syrups').map((c) => c.id)).toEqual(['cough', 'cold']);
  expect(childrenOf(CATS, 'dry')).toEqual([]);
});

test('childrenOf treats a missing parentId as top level', () => {
  const legacy = { id: 'old', name: 'Old', order: 5, lastCheckedAt: null } as Category;
  expect(childrenOf([...CATS, legacy], null).map((c) => c.id)).toEqual(['syrups', 'balms', 'old']);
});

test('descendantIds goes to any depth and excludes self', () => {
  expect(descendantIds(CATS, 'syrups').sort()).toEqual(['cold', 'cough', 'dry']);
  expect(descendantIds(CATS, 'cough')).toEqual(['dry']);
  expect(descendantIds(CATS, 'balms')).toEqual([]);
});

test('descendantIds and pathOf terminate on a corrupt cycle', () => {
  const loop = [cat('a', 'b'), cat('b', 'a')];
  expect(descendantIds(loop, 'a')).toEqual(['b']);
  expect(pathOf(loop, 'a')).toEqual(['B', 'A']);
});

test('pathOf and pathLabel run root to self', () => {
  expect(pathOf(CATS, 'dry')).toEqual(['Syrups', 'Cough', 'Dry']);
  expect(pathLabel(CATS, 'dry')).toBe('Syrups › Cough › Dry');
  expect(pathLabel(CATS, 'balms')).toBe('Balms');
  expect(pathOf(CATS, 'nope')).toEqual([]);
});

test('isDescendant', () => {
  expect(isDescendant(CATS, 'dry', 'syrups')).toBe(true);
  expect(isDescendant(CATS, 'syrups', 'dry')).toBe(false);
  expect(isDescendant(CATS, 'syrups', 'syrups')).toBe(false);
});

test('walk is depth-first in sibling order', () => {
  expect(walk(CATS).map((c) => c.id)).toEqual(['syrups', 'cough', 'dry', 'cold', 'balms']);
});

test('nextOrder is max sibling order + 1', () => {
  expect(nextOrder(CATS, null)).toBe(2);
  expect(nextOrder(CATS, 'cough')).toBe(1);
  expect(nextOrder(CATS, 'dry')).toBe(0);
});

describe('rollupSummary', () => {
  const today = new Date(2026, 10, 6);
  const d = { first: 90, second: 30 };
  const med = (id: string, categoryId: string): Medicine => ({
    id,
    name: id,
    categoryId,
    companyId: 'co',
    unit: 'bottle',
  });
  const batch = (medicineId: string, qty: number, year: number, month: number): Batch => ({
    id: `${medicineId}-${year}-${month}`,
    medicineId,
    batchNo: 'X',
    expiry: { year, month },
    qty,
    billId: null,
    status: 'active',
    createdAt: 0,
  });
  const meds = [med('m1', 'syrups'), med('m2', 'cough'), med('m3', 'dry'), med('m4', 'balms')];
  const batches = [
    batch('m1', 2, 2030, 1), // ok
    batch('m2', 3, 2026, 11), // soon
    batch('m3', 4, 2026, 9), // expired
    batch('m3', 1, 2026, 10), // expired
    batch('m4', 9, 2026, 9), // expired, but outside syrups
  ];

  it('counts self and every sub-folder, with the worst status across them', () => {
    expect(rollupSummary(CATS, meds, batches, 'syrups', today, d)).toEqual({
      medicineCount: 3,
      unitCount: 10,
      worst: 'expired',
      worstCount: 2,
    });
    expect(rollupSummary(CATS, meds, batches, 'cold', today, d)).toEqual({
      medicineCount: 0,
      unitCount: 0,
      worst: null,
      worstCount: 0,
    });
  });

  it('a leaf matches categorySummary-style counts', () => {
    expect(rollupSummary(CATS, meds, batches, 'cough', today, d)).toMatchObject({
      medicineCount: 2,
      unitCount: 8,
      worst: 'expired',
    });
  });
});
