import { emptyDraft, type DraftBatch } from '@/domain/draft';
import type { Batch, Bill, Category, Company, Medicine, StockEvent } from '@/domain/types';
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
    expect(s.joinSecret.length).toBeGreaterThanOrEqual(24);
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

  it('merges companies and categories', async () => {
    await save([
      draft({ companyName: 'A' }),
      draft({ medicineName: 'Other', companyName: 'B', batchNo: 'Z' }),
    ]);
    const [a, b] = comps();
    await inv().mergeCompanies(shopId, a.id, b.id);
    expect(comps()).toHaveLength(1);
    expect(meds().every((m) => m.companyId === b.id)).toBe(true);
    const cs = last<Category[]>((cb) => inv().watchCategories(shopId, cb));
    await inv().mergeCategories(shopId, cs[0].id, cs[1].id);
    expect(meds().every((m) => m.categoryId === cs[1].id)).toBe(true);
    await inv().renameCompany(shopId, b.id, 'Renamed');
    expect(comps()[0].name).toBe('Renamed');
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

  it('merges reject same or missing ids', async () => {
    await save([draft({})]);
    const [a] = comps();
    const [c] = last<Category[]>((cb) => inv().watchCategories(shopId, cb));
    await expect(inv().mergeCompanies(shopId, a.id, a.id)).rejects.toThrow(/not found|same/);
    await expect(inv().mergeCompanies(shopId, a.id, 'nope')).rejects.toThrow(/not found|same/);
    await expect(inv().mergeCategories(shopId, c.id, c.id)).rejects.toThrow(/not found|same/);
    await expect(inv().mergeCategories(shopId, 'nope', c.id)).rejects.toThrow(/not found|same/);
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
