import { emptyDraft, type DraftBatch } from '@/domain/draft';
import type { Batch, Company, Medicine } from '@/domain/types';
import { planIntake } from '../intake';

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

  it('resolves matchedMedicineId, then fuzzy match, and reuses a medicine created earlier in the intake', () => {
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

  it('duplicate guard: same active medicine + batchNo (trim, any case) adds qty', () => {
    const p = planIntake(
      {
        medicines: [med],
        companies: [co],
        batches: [batch(), batch({ id: 'old', status: 'removed', batchNo: 'b2' })],
      },
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
    expect(p.batches[1].id).not.toBe('old');
    expect(p.events.map((e) => [e.batchId, e.delta])).toEqual([
      ['b1', 3],
      [p.batches[1].id, 1],
      [p.batches[1].id, 4],
    ]);
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
