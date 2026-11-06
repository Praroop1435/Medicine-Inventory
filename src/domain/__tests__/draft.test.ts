import {
  applyMatch,
  canSave,
  confirmField,
  draftIssues,
  emptyDraft,
  fromMedicine,
  mergeTarget,
} from '../draft';
import type { DraftBatch } from '../draft';
import type { Company, Medicine } from '../types';

const full = (p: Partial<DraftBatch> = {}): DraftBatch => ({
  ...emptyDraft('manual'),
  medicineName: 'Azithral 500',
  companyName: 'Alembic',
  categoryId: 'c1',
  unit: 'strip',
  batchNo: 'B1',
  expiry: { year: 2027, month: 3 },
  qty: 5,
  ...p,
});

describe('emptyDraft', () => {
  it('has unique keys and empty fields', () => {
    const a = emptyDraft('scan');
    expect(a.key).not.toBe(emptyDraft('scan').key);
    expect(a).toMatchObject({ source: 'scan', qty: null, expiry: null, uncertain: [] });
  });
});

describe('draftIssues', () => {
  it('flags everything on an empty draft', () => {
    expect(draftIssues(emptyDraft('manual')).sort()).toEqual(
      ['batchNo', 'categoryId', 'companyName', 'expiry', 'medicineName', 'qty', 'unit'].sort(),
    );
  });
  it('flags missing category, qty 0, null expiry', () => {
    expect(draftIssues(full({ categoryId: null }))).toContain('categoryId');
    expect(draftIssues(full({ qty: 0 }))).toContain('qty');
    expect(draftIssues(full({ qty: 1.5 }))).toContain('qty');
    expect(draftIssues(full({ expiry: null }))).toContain('expiry');
    expect(draftIssues(full())).toEqual([]);
  });
  it('does not require company/category/unit when matched', () => {
    expect(
      draftIssues(full({ matchedMedicineId: 'm1', companyName: '', categoryId: null, unit: null })),
    ).toEqual([]);
  });
});

describe('applyMatch', () => {
  const meds: Medicine[] = [
    { id: 'm1', name: 'Azithral 500', categoryId: 'cat9', companyId: 'co1', unit: 'box' },
  ];
  const cos: Company[] = [{ id: 'co1', name: 'Alembic' }];
  it('fills from the match', () => {
    const d = applyMatch(emptyDraft('manual'), meds, cos);
    expect(d.matchedMedicineId).toBeNull();
    const m = applyMatch({ ...emptyDraft('manual'), medicineName: 'azithral-500' }, meds, cos);
    expect(m).toMatchObject({
      matchedMedicineId: 'm1',
      companyName: 'Alembic',
      categoryId: 'cat9',
      unit: 'box',
    });
  });
  it('a fuzzy match makes a human check the name; an exact one does not', () => {
    const exact = applyMatch(full({ medicineName: 'AZITHRAL-500' }), meds, cos);
    expect(exact.uncertain).toEqual([]);
    const fuzzy = applyMatch(full({ medicineName: 'Azitral 500' }), meds, cos);
    expect(fuzzy).toMatchObject({ matchedMedicineId: 'm1', uncertain: ['medicineName'] });
    // Re-applying the same match keeps a confirmation.
    expect(applyMatch(confirmField(fuzzy, 'medicineName'), meds, cos).uncertain).toEqual([]);
  });
  it('fromMedicine matches by id, not by name', () => {
    const twin: Medicine = { ...meds[0], id: 'm2', categoryId: 'cat2' };
    expect(fromMedicine(emptyDraft('manual'), twin, cos)).toMatchObject({
      medicineName: 'Azithral 500',
      matchedMedicineId: 'm2',
      categoryId: 'cat2',
      companyName: 'Alembic',
      unit: 'box',
    });
  });
  it('clears match but keeps fields when none', () => {
    const d = applyMatch(full({ matchedMedicineId: 'old', medicineName: 'Zzz' }), meds, cos);
    expect(d).toMatchObject({ matchedMedicineId: null, companyName: 'Alembic', categoryId: 'c1' });
  });
});

describe('canSave / confirmField', () => {
  it('rejects empty list', () => expect(canSave([])).toBe(false));
  it('blocks on uncertain until confirmed', () => {
    const d = full({ uncertain: ['expiry'] });
    expect(canSave([d])).toBe(false);
    expect(canSave([confirmField(d, 'expiry')])).toBe(true);
  });
  it('blocks on issues', () => expect(canSave([full({ qty: 0 })])).toBe(false));
});

describe('mergeTarget', () => {
  const b = { id: 'b1', medicineId: 'm1', batchNo: 'B1', expiry: { year: 2027, month: 3 } };
  it('finds the batch with the same medicine, batch no (any case) and expiry', () => {
    expect(mergeTarget([b], 'm1', full({ batchNo: ' b1 ' }))).toBe(b);
  });
  it('a different expiry, batch no or medicine is a separate batch', () => {
    expect(mergeTarget([b], 'm1', full({ expiry: { year: 2027, month: 4 } }))).toBeUndefined();
    expect(mergeTarget([b], 'm1', full({ batchNo: 'B2' }))).toBeUndefined();
    expect(mergeTarget([b], 'm2', full())).toBeUndefined();
    expect(mergeTarget([b], 'm1', full({ expiry: null }))).toBeUndefined();
  });
});
