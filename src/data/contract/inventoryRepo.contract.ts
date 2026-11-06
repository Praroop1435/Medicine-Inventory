import { emptyDraft, type DraftBatch } from '@/domain/draft';
import type { Batch, Category, Company, Medicine, StockEvent } from '@/domain/types';
import type { Repos } from '../repositories';

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
}
