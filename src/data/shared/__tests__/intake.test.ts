import { emptyDraft, type DraftBatch } from '@/domain/draft';
import type { Batch, Company, Medicine } from '@/domain/types';
import { chunkPlan, planIntake } from '../intake';

const draft = (o: Partial<DraftBatch> = {}): DraftBatch => ({
  ...emptyDraft('manual'),
  medicineName: 'Azithral 500',
  companyName: 'Alembic',
  categoryId: 'c1',
  unit: 'strip',
  batchNo: 'B1',
  expiry: { year: 2027, month: 6 },
  qty: 5,
  ...o,
});
const co: Company = { id: 'co1', name: 'Alembic Ltd' };
const med: Medicine = {
  id: 'm1',
  name: 'Azithral 500',
  categoryId: 'c1',
  companyId: 'co1',
  unit: 'strip',
};
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
const empty = { medicines: [], companies: [], batches: [] };

describe('planIntake', () => {
  it('creates company, medicine, batch, event and bill for a new medicine', () => {
    const p = planIntake(
      empty,
      [draft({ medicineName: ' Azithral 500 ', companyName: ' Alembic ' })],
      { supplier: 'S', billNo: '1', billDate: '2026-01-01', scannedBy: 'd1' },
      'd1',
      100,
    );
    expect(p.companies).toEqual([{ id: expect.any(String), name: 'Alembic' }]);
    expect(p.medicines).toEqual([
      {
        id: expect.any(String),
        name: 'Azithral 500',
        categoryId: 'c1',
        companyId: p.companies[0].id,
        unit: 'strip',
      },
    ]);
    expect(p.bill).toMatchObject({ supplier: 'S', createdAt: 100 });
    expect(p.batches).toEqual([
      expect.objectContaining({
        medicineId: p.medicines[0].id,
        batchNo: 'B1',
        qty: 5,
        billId: p.bill!.id,
        status: 'active',
        createdAt: 100,
      }),
    ]);
    expect(p.events).toEqual([
      expect.objectContaining({
        batchId: p.batches[0].id,
        medicineId: p.medicines[0].id,
        type: 'added',
        delta: 5,
        deviceId: 'd1',
        at: 100,
      }),
    ]);
  });

  it('passes a scanned pack onto a new medicine only', () => {
    const p = planIntake(empty, [draft({ packInfo: '1*30ML' })], null, 'd1', 1);
    expect(p.medicines[0].packInfo).toBe('1*30ML');
    expect('packInfo' in planIntake(empty, [draft()], null, 'd1', 1).medicines[0]).toBe(false);
  });

  it('reuses a company by normalized name', () => {
    const p = planIntake(
      { ...empty, companies: [{ id: 'co9', name: 'Sun-Pharma' }] },
      [draft({ medicineName: 'New', companyName: 'sun pharma' })],
      null,
      'd1',
      1,
    );
    expect(p.companies).toEqual([]);
    expect(p.medicines[0].companyId).toBe('co9');
    expect(p.bill).toBeNull();
    expect(p.batches[0].billId).toBeNull();
  });

  it('resolves matchedMedicineId, then an exact name, and reuses a medicine created earlier in the intake', () => {
    const p = planIntake(
      { medicines: [med], companies: [co], batches: [] },
      [
        draft({
          medicineName: 'whatever',
          matchedMedicineId: 'm1',
          companyName: '',
          categoryId: null,
          unit: null,
        }),
        draft({
          medicineName: 'azithral-500',
          batchNo: 'B2',
          companyName: '',
          categoryId: null,
          unit: null,
        }),
        draft({ medicineName: 'Dolo 650', batchNo: 'X' }),
        draft({ medicineName: 'DOLO 650', batchNo: 'Y' }),
      ],
      null,
      'd1',
      1,
    );
    expect(p.medicines.map((m) => m.name)).toEqual(['Dolo 650']);
    expect(p.batches.map((b) => b.medicineId)).toEqual([
      'm1',
      'm1',
      p.medicines[0].id,
      p.medicines[0].id,
    ]);
  });

  it('duplicate guard: same medicine + batchNo (trim, any case) + expiry adds qty', () => {
    const p = planIntake(
      { medicines: [med], companies: [co], batches: [batch()] },
      [
        draft({ batchNo: ' b1 ', qty: 3 }),
        draft({ batchNo: 'B2', qty: 1 }),
        draft({ batchNo: 'b2', qty: 4 }),
      ],
      null,
      'd1',
      1,
    );
    expect(p.batches).toHaveLength(2);
    expect(p.batches[0]).toEqual(batch({ qty: 5 }));
    expect(p.batches[1]).toMatchObject({ batchNo: 'B2', qty: 5, status: 'active' });
    expect(p.events.map((e) => [e.batchId, e.delta])).toEqual([
      ['b1', 3],
      [p.batches[1].id, 1],
      [p.batches[1].id, 4],
    ]);
  });

  it('a different confirmed expiry is a separate batch', () => {
    const p = planIntake(
      { medicines: [med], companies: [co], batches: [batch()] },
      [draft({ expiry: { year: 2027, month: 7 }, qty: 3 })],
      null,
      'd1',
      1,
    );
    expect(p.batches).toHaveLength(1);
    expect(p.batches[0]).toMatchObject({ batchNo: 'B1', expiry: { year: 2027, month: 7 }, qty: 3 });
    expect(p.batches[0].id).not.toBe('b1');
  });

  it('restocking a removed batch makes it live again (one row); a returned one is left alone', () => {
    const p = planIntake(
      {
        medicines: [med],
        companies: [co],
        batches: [
          batch({ id: 'gone', status: 'removed', qty: 0 }),
          batch({ id: 'back', batchNo: 'B2', status: 'returned', qty: 7 }),
        ],
      },
      [draft({ qty: 3 }), draft({ qty: 1 }), draft({ batchNo: 'B2', qty: 2 })],
      null,
      'd1',
      1,
    );
    expect(p.batches).toHaveLength(2);
    expect(p.batches[0]).toEqual(batch({ id: 'gone', status: 'active', qty: 4 }));
    expect(p.batches[1]).toMatchObject({ batchNo: 'B2', qty: 2, status: 'active' });
    expect(p.batches[1].id).not.toBe('back');
  });

  it('within one intake only an exact name reuses a new medicine', () => {
    const p = planIntake(
      empty,
      [
        draft({ medicineName: 'CLAVAM BID DRY SYP', batchNo: 'A' }),
        draft({ medicineName: 'CLAVAM DRY SYP', batchNo: 'B' }),
        draft({ medicineName: 'Cetirizine 10', batchNo: 'C' }),
        draft({ medicineName: 'Levocetirizine 10', batchNo: 'D' }),
        draft({ medicineName: 'clavam-bid dry syp', batchNo: 'E' }),
      ],
      null,
      'd1',
      1,
    );
    expect(p.medicines.map((m) => m.name)).toEqual([
      'CLAVAM BID DRY SYP',
      'CLAVAM DRY SYP',
      'Cetirizine 10',
      'Levocetirizine 10',
    ]);
    expect(p.batches[4].medicineId).toBe(p.medicines[0].id);
  });

  it('an unmatched draft never joins an existing medicine on a near name', () => {
    const p = planIntake(
      { medicines: [med], companies: [co], batches: [] },
      [draft({ medicineName: 'Azitral 500' })],
      null,
      'd1',
      1,
    );
    expect(p.medicines.map((m) => m.name)).toEqual(['Azitral 500']);
  });

  it('does not mutate the input state', () => {
    const state = { medicines: [med], companies: [co], batches: [batch()] };
    const copy = structuredClone(state);
    planIntake(
      state,
      [draft({ qty: 3 }), draft({ medicineName: 'New', batchNo: 'N' })],
      null,
      'd1',
      1,
    );
    expect(state).toEqual(copy);
  });

  it.each([
    ['missing category on a new medicine', { categoryId: null }],
    ['missing unit on a new medicine', { unit: null }],
    ['missing expiry', { expiry: null }],
    ['zero qty', { qty: 0 }],
    ['blank batch', { batchNo: ' ' }],
  ])('rejects %s', (_, o) => {
    expect(() =>
      planIntake(empty, [draft({ medicineName: 'Ok', batchNo: 'O' }), draft(o)], null, 'd1', 1),
    ).toThrow(/incomplete/);
  });

  it('rejects an expiry month outside 1-12', () => {
    expect(() =>
      planIntake(empty, [draft({ expiry: { year: 2027, month: 13 } })], null, 'd1', 1),
    ).toThrow(/invalid expiry/);
  });
});

describe('chunkPlan', () => {
  const size = (p: ReturnType<typeof chunkPlan>[number]) =>
    (p.bill ? 1 : 0) + p.companies.length + p.medicines.length + p.batches.length + p.events.length;

  it('a 300-row intake splits into 3 writes of at most 450, losing nothing', () => {
    const drafts = Array.from({ length: 300 }, (_, i) =>
      draft({ medicineName: `Med ${i}`, batchNo: `B${i}` }),
    );
    const bill = { supplier: 'S', billNo: '1', billDate: '2026-01-01', scannedBy: 'd1' };
    const p = planIntake(empty, drafts, bill, 'd1', 1);
    const chunks = chunkPlan(p);
    expect(chunks).toHaveLength(3);
    chunks.forEach((c) => expect(size(c)).toBeLessThanOrEqual(450));
    expect(chunks[0].bill).toBe(p.bill);
    expect(chunks.flatMap((c) => c.medicines)).toEqual(p.medicines);
    expect(chunks.flatMap((c) => c.batches)).toEqual(p.batches);
    expect(chunks.flatMap((c) => c.events)).toEqual(p.events);
    // A batch travels with its events.
    for (const c of chunks)
      expect(c.events.every((e) => c.batches.some((b) => b.id === e.batchId))).toBe(true);
  });

  it('a small bill is one write', () => {
    const p = planIntake(empty, [draft(), draft({ batchNo: 'B2' })], null, 'd1', 1);
    expect(chunkPlan(p)).toEqual([p]);
  });
});
