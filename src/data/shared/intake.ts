import { draftIssues, type DraftBatch } from '@/domain/draft';
import { findMedicineMatch, normalizeName } from '@/domain/matching';
import type { Batch, Bill, Company, Medicine, StockEvent } from '@/domain/types';
import { newId } from '@/lib/ids';
import { eventFor, sameBatchNo } from './mutations';

export type IntakeState = { medicines: Medicine[]; companies: Company[]; batches: Batch[] };

// Everything a saveIntake must write. `batches` holds new and updated batches as full records.
export type IntakePlan = {
  bill: Bill | null;
  companies: Company[];
  medicines: Medicine[];
  batches: Batch[];
  events: StockEvent[];
};

export const resolveMedicine = (d: DraftBatch, medicines: Medicine[]): Medicine | null =>
  medicines.find((m) => m.id === d.matchedMedicineId) ??
  findMedicineMatch(d.medicineName, medicines);

// Validates every draft before returning, so a throw means nothing may be written.
export function planIntake(
  state: IntakeState,
  drafts: DraftBatch[],
  bill: Omit<Bill, 'id' | 'createdAt'> | null,
  deviceId: string,
  at: number,
): IntakePlan {
  const medicines = [...state.medicines];
  const companies = [...state.companies];
  const batches = state.batches.map((b) => ({ ...b }));
  const touched = new Map<string, Batch>();
  const plan: IntakePlan = {
    bill: bill ? { ...bill, id: newId(), createdAt: at } : null,
    companies: [],
    medicines: [],
    batches: [],
    events: [],
  };
  for (const d of drafts) {
    let med = resolveMedicine(d, medicines);
    if (
      draftIssues({ ...d, matchedMedicineId: med?.id ?? null }).length ||
      !d.expiry ||
      d.qty === null
    )
      throw new Error('incomplete draft');
    if (d.expiry.month < 1 || d.expiry.month > 12) throw new Error('invalid expiry');
    if (!med) {
      if (!d.categoryId || !d.unit) throw new Error('incomplete draft');
      const cn = normalizeName(d.companyName);
      let co = companies.find((c) => normalizeName(c.name) === cn);
      if (!co) {
        co = { id: newId(), name: d.companyName.trim() };
        companies.push(co);
        plan.companies.push(co);
      }
      med = {
        id: newId(),
        name: d.medicineName.trim(),
        categoryId: d.categoryId,
        companyId: co.id,
        unit: d.unit,
      };
      medicines.push(med);
      plan.medicines.push(med);
    }
    const medId = med.id;
    let b = batches.find(
      (x) => x.status === 'active' && x.medicineId === medId && sameBatchNo(x.batchNo, d.batchNo),
    );
    if (b) b.qty += d.qty;
    else {
      b = {
        id: newId(),
        medicineId: medId,
        batchNo: d.batchNo.trim(),
        expiry: d.expiry,
        qty: d.qty,
        billId: plan.bill?.id ?? null,
        status: 'active',
        createdAt: at,
      };
      batches.push(b);
    }
    touched.set(b.id, b);
    plan.events.push({
      ...eventFor(b, 'added', d.qty, deviceId, at),
      billId: plan.bill?.id ?? null,
    });
  }
  plan.batches = [...touched.values()];
  return plan;
}
