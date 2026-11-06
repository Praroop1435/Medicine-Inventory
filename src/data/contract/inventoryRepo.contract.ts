import { emptyDraft, type DraftBatch } from '@/domain/draft';
import {
  DEFAULT_UNITS,
  type Batch,
  type Bill,
  type Category,
  type Company,
  type Medicine,
  type Shop,
  type StockEvent,
} from '@/domain/types';
import type { CheckSession, Repos } from '../repositories';

const last = <T>(w: (cb: (v: T) => void) => () => void): T => {
  let v: T | undefined;
  w((x) => (v = x))();
  return v as T;
};

export function runInventoryContract(make: () => Repos): void {
  let r: Repos;
  let shopId: string;
  let deviceId: string;
  let joinSecret: string;
  let catId: string;

  const draft = (o: Partial<DraftBatch>): DraftBatch => ({
    ...emptyDraft('manual'),
    medicineName: 'Azithral 500',
    companyName: 'Alembic',
    categoryId: catId,
    unit: 'strip',
    batchNo: 'B1',
    expiry: { year: 2027, month: 6 },
    qty: 5,
    ...o,
  });
  const inv = () => r.inventory;
  const batches = () => last<Batch[]>((cb) => inv().watchLiveBatches(shopId, cb));
  const meds = () => last<Medicine[]>((cb) => inv().watchMedicines(shopId, cb));
  const comps = () => last<Company[]>((cb) => inv().watchCompanies(shopId, cb));
  const events = (m: string) =>
    last<StockEvent[]>((cb) => inv().watchMedicineEvents(shopId, m, 50, cb));
  const save = (ds: DraftBatch[], bill = null as Parameters<Repos['inventory']['saveIntake']>[2]) =>
    inv().saveIntake(shopId, ds, bill, deviceId);

  beforeEach(async () => {
    r = make();
    ({ shopId, joinSecret, deviceId } = await r.shop.createShop('Shop', 'Me'));
    catId = last<Category[]>((cb) => inv().watchCategories(shopId, cb))[0].id;
  });

  it('reorderCategories renumbers 0..n-1 and leaves other fields alone', async () => {
    const cs = last<Category[]>((cb) => inv().watchCategories(shopId, cb));
    await inv().upsertCategory(shopId, { ...cs[0], lastCheckedAt: 123 });
    const ids = cs.map((c) => c.id).reverse();
    await inv().reorderCategories(shopId, ids, deviceId);
    const after = last<Category[]>((cb) => inv().watchCategories(shopId, cb));
    const byOrder = [...after].sort((a, b) => a.order - b.order);
    expect(byOrder.map((c) => c.id)).toEqual(ids);
    expect(byOrder.map((c) => c.order)).toEqual(ids.map((_, i) => i));
    expect(after.find((c) => c.id === cs[0].id)?.lastCheckedAt).toBe(123);
  });

  describe('folders', () => {
    const all = () => last<Category[]>((cb) => inv().watchCategories(shopId, cb));
    const byId = (id: string) => all().find((c) => c.id === id);
    const folder = (name: string, parentId: string | null, order = 0) =>
      inv().upsertCategory(shopId, { name, order, lastCheckedAt: null, parentId });

    it('existing categories are top level (parentId null)', () => {
      expect(all().every((c) => c.parentId === null)).toBe(true);
    });

    it('upsertCategory stores parentId', async () => {
      const cough = await folder('Cough', catId);
      expect(byId(cough)).toMatchObject({ name: 'Cough', parentId: catId });
    });

    it('moveCategory sets parentId, appends to the new siblings and leaves other fields alone', async () => {
      const a = await folder('A', catId, 0);
      const b = await folder('B', catId, 4);
      const other = all().find((c) => c.parentId === null && c.id !== catId)!;
      await inv().upsertCategory(shopId, { ...other, lastCheckedAt: 77 });
      await inv().moveCategory(shopId, other.id, catId, deviceId);
      expect(byId(other.id)).toMatchObject({
        parentId: catId,
        order: 5,
        name: other.name,
        lastCheckedAt: 77,
      });
      await inv().moveCategory(shopId, b, null, deviceId);
      expect(byId(b)?.parentId).toBeNull();
      expect(byId(b)?.order).toBe(
        Math.max(
          ...all()
            .filter((c) => c.id !== b && c.parentId === null)
            .map((c) => c.order),
        ) + 1,
      );
      expect(byId(a)?.parentId).toBe(catId);
    });

    it('moveCategory rejects moving into itself or a descendant (depth 3)', async () => {
      const cough = await folder('Cough', catId);
      const dry = await folder('Dry', cough);
      await expect(inv().moveCategory(shopId, catId, catId, deviceId)).rejects.toThrow(/cycle/);
      await expect(inv().moveCategory(shopId, catId, cough, deviceId)).rejects.toThrow(/cycle/);
      await expect(inv().moveCategory(shopId, catId, dry, deviceId)).rejects.toThrow(/cycle/);
      expect(byId(catId)?.parentId).toBeNull();
      await expect(inv().moveCategory(shopId, 'nope', null, deviceId)).rejects.toThrow(/not found/);
      await expect(inv().moveCategory(shopId, dry, 'nope', deviceId)).rejects.toThrow(/not found/);
    });

    it('renameCategory changes only the name', async () => {
      const cough = await folder('Cough', catId, 3);
      await inv().upsertCategory(shopId, { ...byId(cough)!, lastCheckedAt: 55 });
      await inv().renameCategory(shopId, cough, '  Wet cough ', deviceId);
      expect(byId(cough)).toEqual({
        id: cough,
        name: 'Wet cough',
        order: 3,
        lastCheckedAt: 55,
        parentId: catId,
      });
    });

    it('renameCategory rejects a blank name, a missing folder and a non-member', async () => {
      await expect(inv().renameCategory(shopId, catId, '  ', deviceId)).rejects.toThrow(/name/);
      await expect(inv().renameCategory(shopId, 'nope', 'X', deviceId)).rejects.toThrow(
        /not found/,
      );
      await expect(inv().renameCategory(shopId, catId, 'X', 'ghost')).rejects.toThrow(
        /not a member/,
      );
      expect(byId(catId)?.name).toBe('Antibiotics');
    });

    it('deleteCategory removes an empty folder', async () => {
      const cough = await folder('Cough', catId);
      await inv().deleteCategory(shopId, cough, deviceId);
      expect(byId(cough)).toBeUndefined();
    });

    it('deleteCategory rejects a folder with sub-folders or medicines', async () => {
      await folder('Cough', catId);
      await expect(inv().deleteCategory(shopId, catId, deviceId)).rejects.toThrow(/not empty/);
      const other = all().find((c) => c.parentId === null && c.id !== catId)!;
      await save([draft({ categoryId: other.id })]);
      await expect(inv().deleteCategory(shopId, other.id, deviceId)).rejects.toThrow(/not empty/);
      expect(byId(catId)).toBeDefined();
      expect(byId(other.id)).toBeDefined();
    });
  });

  it('watchBill returns one bill, null when unknown; added events carry billId', async () => {
    await save([draft({})], {
      supplier: 'S',
      billNo: '9',
      billDate: '2026-01-01',
      scannedBy: deviceId,
    });
    const billId = batches()[0].billId as string;
    expect(last<Bill | null>((cb) => inv().watchBill(shopId, billId, cb))).toMatchObject({
      id: billId,
      supplier: 'S',
      billNo: '9',
    });
    expect(last<Bill | null>((cb) => inv().watchBill(shopId, 'nope', cb))).toBeNull();
    expect(events(batches()[0].medicineId)[0]).toMatchObject({ type: 'added', billId });
    await save([draft({ batchNo: 'B2' })]);
    expect(events(batches()[0].medicineId)[0].billId ?? null).toBeNull();
  });

  it('seeds categories and defaults', () => {
    const cs = last<Category[]>((cb) => inv().watchCategories(shopId, cb));
    expect(cs.map((c) => c.name)).toEqual([
      'Antibiotics',
      'Cough syrups',
      'Pain relief',
      'Balms',
      'Lotions',
      'Eye/ear drops',
      'Tablets (general)',
      'Vitamins',
      'Others',
    ]);
    expect(cs.map((c) => c.order)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    const s = last<import('@/domain/types').Shop>((cb) => r.shop.watchShop(shopId, cb));
    expect(s.alertDays).toEqual({ first: 90, second: 30 });
    expect(s.notifyTime).toBe('09:00');
    expect(s.nightTime).toBe('21:00');
    expect(s.joinSecret.length).toBeGreaterThanOrEqual(24);
  });

  describe('units', () => {
    const units = () => last<Shop>((cb) => r.shop.watchShop(shopId, cb)).units;
    it('a new shop gets the default units', () => expect(units()).toEqual(DEFAULT_UNITS));
    it('addUnit trims, lowercases and appends; duplicates in any case are a no-op', async () => {
      await r.shop.addUnit(shopId, '  Kit ', deviceId);
      await r.shop.addUnit(shopId, 'KIT', deviceId);
      await r.shop.addUnit(shopId, 'Strip', deviceId);
      expect(units()).toEqual([...DEFAULT_UNITS, 'kit']);
    });
    it('addUnit rejects blank and over-long units', async () => {
      await expect(r.shop.addUnit(shopId, '   ', deviceId)).rejects.toThrow();
      await expect(r.shop.addUnit(shopId, 'x'.repeat(25), deviceId)).rejects.toThrow();
      expect(units()).toEqual(DEFAULT_UNITS);
    });
  });

  it('saveIntake creates company, medicine, batch and an added event', async () => {
    await save([draft({ qty: 11 })]);
    expect(comps()).toHaveLength(1);
    expect(meds()).toHaveLength(1);
    const b = batches();
    expect(b).toHaveLength(1);
    expect(b[0].qty).toBe(11);
    expect(b[0].billId).toBeNull();
    const ev = events(meds()[0].id);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ type: 'added', delta: 11 });
  });

  it('links batches to the bill', async () => {
    await save([draft({})], {
      supplier: 'S',
      billNo: '1',
      billDate: '2026-01-01',
      scannedBy: deviceId,
    });
    expect(batches()[0].billId).toEqual(expect.any(String));
  });

  it('duplicate guard adds qty to the existing batch', async () => {
    await save([draft({ qty: 2 })]);
    await save([draft({ qty: 3, batchNo: ' b1 ' })]);
    const b = batches();
    expect(b).toHaveLength(1);
    expect(b[0].qty).toBe(5);
    expect(events(meds()[0].id)).toHaveLength(2);
  });

  it('a different expiry under the same batch no is its own batch', async () => {
    await save([draft({ qty: 2 })]);
    await save([draft({ qty: 3, expiry: { year: 2027, month: 9 } })]);
    expect(
      batches()
        .map((b) => [b.batchNo, b.expiry.month, b.qty])
        .sort(),
    ).toEqual([
      ['B1', 6, 2],
      ['B1', 9, 3],
    ]);
  });

  it('restocking a sold-out batch brings the same row back live', async () => {
    await save([draft({ qty: 1 })]);
    const id = batches()[0].id;
    await inv().sellOne(shopId, id, deviceId);
    expect(batches()).toHaveLength(0);
    await save([draft({ qty: 4 })]);
    expect(batches()).toEqual([expect.objectContaining({ id, qty: 4, status: 'active' })]);
  });

  it('counting a sold-out batch above zero brings it back live', async () => {
    await save([draft({ qty: 1 })]);
    const id = batches()[0].id;
    await inv().setCount(shopId, id, 0, deviceId, 'count_fixed');
    expect(batches()).toHaveLength(0);
    await r.check.markChecked(shopId, catId, id, 2, deviceId);
    expect(batches()).toEqual([expect.objectContaining({ id, qty: 2, status: 'active' })]);
    await inv().setCount(shopId, id, 0, deviceId, 'count_fixed');
    await inv().setCount(shopId, id, 3, deviceId, 'count_fixed');
    expect(batches()).toEqual([expect.objectContaining({ id, qty: 3, status: 'active' })]);
  });

  it('same medicine twice in one intake yields one medicine, two batches', async () => {
    await save([
      draft({ medicineName: 'Azithral 500', batchNo: 'A' }),
      draft({ medicineName: 'azithral-500', batchNo: 'B' }),
    ]);
    expect(meds()).toHaveLength(1);
    expect(comps()).toHaveLength(1);
    expect(batches()).toHaveLength(2);
  });

  it('sellOne decrements, removes at zero, rejects with no stock', async () => {
    await save([draft({ qty: 2 })]);
    const id = batches()[0].id;
    await inv().sellOne(shopId, id, deviceId);
    expect(batches()[0].qty).toBe(1);
    expect(events(meds()[0].id)[0]).toMatchObject({ type: 'sold', delta: -1 });
    await inv().sellOne(shopId, id, deviceId);
    expect(batches()).toHaveLength(0);
    await expect(inv().sellOne(shopId, id, deviceId)).rejects.toThrow(/no stock/);
  });

  it('setCount handles zero, negative and delta', async () => {
    await save([draft({ qty: 5 })]);
    const id = batches()[0].id;
    await expect(inv().setCount(shopId, id, -1, deviceId, 'count_fixed')).rejects.toThrow();
    await inv().setCount(shopId, id, 3, deviceId, 'count_fixed');
    expect(events(meds()[0].id)[0]).toMatchObject({ type: 'count_fixed', delta: -2 });
    await inv().setCount(shopId, id, 0, deviceId, 'checked');
    expect(batches()).toHaveLength(0);
  });

  it('markReturned removes from live batches', async () => {
    await save([draft({})]);
    await inv().markReturned(shopId, batches()[0].id, deviceId);
    expect(batches()).toHaveLength(0);
  });

  it('watch calls back immediately and on change, and unsubscribes', async () => {
    const seen: number[] = [];
    const un = inv().watchLiveBatches(shopId, (b) => seen.push(b.length));
    await save([draft({})]);
    un();
    await save([draft({ batchNo: 'Q' })]);
    expect(seen).toEqual([0, 1]);
  });

  it('joinShop rejects a wrong secret; removed device cannot write', async () => {
    await expect(r.shop.joinShop(shopId, 'nope', 'X')).rejects.toThrow(/invalid/);
    const { deviceId: d2 } = await r.shop.joinShop(shopId, joinSecret, 'Two');
    await r.shop.removeDevice(shopId, d2, deviceId);
    await expect(inv().saveIntake(shopId, [draft({})], null, d2)).rejects.toThrow(/not a member/);
    await expect(inv().sellOne(shopId, 'x', 'ghost')).rejects.toThrow(/not a member/);
  });

  it('saveIntake is atomic: an invalid later draft persists nothing', async () => {
    await expect(
      save(
        [
          draft({ medicineName: 'Good', batchNo: 'G' }),
          draft({ medicineName: 'Bad', batchNo: 'X', categoryId: null }),
        ],
        { supplier: 'S', billNo: '1', billDate: '2026-01-01', scannedBy: deviceId },
      ),
    ).rejects.toThrow();
    expect(comps()).toHaveLength(0);
    expect(meds()).toHaveLength(0);
    expect(batches()).toHaveLength(0);
    await save([draft({})]);
    expect(events(meds()[0].id)).toHaveLength(1);
  });

  it('setCount and markReturned reject on non-active batches', async () => {
    await save([draft({})]);
    const id = batches()[0].id;
    await inv().markReturned(shopId, id, deviceId);
    await expect(inv().setCount(shopId, id, 1, deviceId, 'checked')).rejects.toThrow(/not active/);
    await expect(inv().markReturned(shopId, id, deviceId)).rejects.toThrow(/not active/);
  });

  describe('check', () => {
    const session = () => last<CheckSession | null>((cb) => r.check.watchCheck(shopId, catId, cb));
    const category = () =>
      last<Category[]>((cb) => inv().watchCategories(shopId, cb)).find((c) => c.id === catId)!;
    const twoBatches = async () => {
      await save([draft({ batchNo: 'B1', qty: 5 }), draft({ batchNo: 'B2', qty: 3 })]);
      const bs = batches();
      return bs.map((b) => b.id);
    };

    it('markChecked records the absolute count as a checked event and the row in the session', async () => {
      const [b1, b2] = await twoBatches();
      expect(session()).toBeNull();
      await r.check.markChecked(shopId, catId, b1, 5, deviceId);
      expect(events(meds()[0].id)[0]).toMatchObject({ type: 'checked', delta: 0, batchId: b1 });
      expect(session()).toMatchObject({
        categoryId: catId,
        startedAt: expect.any(Number),
        checked: { [b1]: { by: deviceId, at: expect.any(Number) } },
      });
      await r.check.markChecked(shopId, catId, b2, 1, deviceId);
      expect(events(meds()[0].id)[0]).toMatchObject({ type: 'checked', delta: -2, batchId: b2 });
      expect(batches().find((b) => b.id === b2)?.qty).toBe(1);
      expect(Object.keys(session()!.checked).sort()).toEqual([b1, b2].sort());
    });

    it('markChecked with 0 closes the batch', async () => {
      const [b1] = await twoBatches();
      await r.check.markChecked(shopId, catId, b1, 0, deviceId);
      expect(batches().map((b) => b.id)).not.toContain(b1);
      expect(events(meds()[0].id)[0]).toMatchObject({ type: 'checked', delta: -5 });
    });

    it('a sale from another phone after the check applies on top of the counted qty', async () => {
      const [b1] = await twoBatches();
      const { deviceId: d2 } = await r.shop.joinShop(shopId, joinSecret, 'Two');
      await r.check.markChecked(shopId, catId, b1, 4, deviceId);
      await inv().sellOne(shopId, b1, d2);
      expect(batches().find((b) => b.id === b1)?.qty).toBe(3);
    });

    it('finishCheck with every row checked sets lastCheckedAt and clears the session', async () => {
      const ids = await twoBatches();
      for (const id of ids) await r.check.markChecked(shopId, catId, id, 2, deviceId);
      await expect(r.check.finishCheck(shopId, catId, ids)).resolves.toEqual({ complete: true });
      expect(category().lastCheckedAt).toEqual(expect.any(Number));
      expect(category().name).toBe('Antibiotics');
      expect(session()).toBeNull();
    });

    it('finishCheck of a parent also marks every sub-folder checked', async () => {
      const cough = await inv().upsertCategory(shopId, {
        name: 'Cough',
        order: 0,
        lastCheckedAt: null,
        parentId: catId,
      });
      const dry = await inv().upsertCategory(shopId, {
        name: 'Dry',
        order: 0,
        lastCheckedAt: null,
        parentId: cough,
      });
      await expect(r.check.finishCheck(shopId, catId, [])).resolves.toEqual({ complete: true });
      const cs = last<Category[]>((cb) => inv().watchCategories(shopId, cb));
      for (const id of [catId, cough, dry])
        expect(cs.find((c) => c.id === id)?.lastCheckedAt).toEqual(expect.any(Number));
      expect(cs.filter((c) => c.lastCheckedAt !== null)).toHaveLength(3);
    });

    it('finishCheck with rows unchecked keeps the session and lastCheckedAt', async () => {
      const [b1, b2] = await twoBatches();
      await r.check.markChecked(shopId, catId, b1, 5, deviceId);
      await expect(r.check.finishCheck(shopId, catId, [b1, b2])).resolves.toEqual({
        complete: false,
      });
      expect(category().lastCheckedAt).toBeNull();
      expect(Object.keys(session()!.checked)).toEqual([b1]);
    });

    it('markChecked rejects for a non-member and an unknown batch', async () => {
      const [b1] = await twoBatches();
      await expect(r.check.markChecked(shopId, catId, b1, 1, 'ghost')).rejects.toThrow(
        /not a member/,
      );
      await expect(r.check.markChecked(shopId, catId, 'nope', 1, deviceId)).rejects.toThrow(
        /not found/,
      );
      expect(session()).toBeNull();
    });
  });
}
