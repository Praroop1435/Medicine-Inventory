import { draftIssues, mergeTarget, type DraftBatch } from '@/domain/draft';
import { normalizeName } from '@/domain/matching';
import type { Batch, Bill, Company, Medicine, StockEvent } from '@/domain/types';
import { newId } from '@/lib/ids';
import { eventFor } from './mutations';

export type IntakeState = { medicines: Medicine[]; companies: Company[]; batches: Batch[] };

// Everything a saveIntake must write. `batches` holds new and updated batches as full records.
export type IntakePlan = {
  bill: Bill | null;
  companies: Company[];
  medicines: Medicine[];
  batches: Batch[];
  events: StockEvent[];
};

// Only the id the review settled on, or an exact name: a near name was either flagged on review
// and kept as matchedMedicineId, or turned down there, so guessing again here would merge products.
export function resolveMedicine(d: DraftBatch, medicines: Medicine[]): Medicine | null {
  const n = normalizeName(d.medicineName);
  return (
    medicines.find((m) => m.id === d.matchedMedicineId) ??
    (n ? medicines.find((m) => normalizeName(m.name) === n) : undefined) ??
    null
  );
}

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
        ...(d.packInfo ? { packInfo: d.packInfo } : {}),
      };
      medicines.push(med);
      plan.medicines.push(med);
    }
    // A returned batch went back to the supplier; a removed one is restocked as the same row.
    let b = mergeTarget(
      batches.filter((x) => x.status !== 'returned'),
      med.id,
      d,
    );
    if (b) {
      if (b.status !== 'active') Object.assign(b, { status: 'active', qty: 0 });
      b.qty += d.qty;
    } else {
      b = {
        id: newId(),
        medicineId: med.id,
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

/**
 * Splits a plan into plans of at most `max` writes (Firestore caps a batch at 500), in an order
 * where nothing lands before what it points at. The bill goes first; a batch and its events are
 * never split.
 */
export function chunkPlan(p: IntakePlan, max = 450): IntakePlan[] {
  const empty = (): IntakePlan => ({
    bill: null,
    companies: [],
    medicines: [],
    batches: [],
    events: [],
  });
  const out = [empty()];
  let size = 0;
  const room = (n: number) => {
    if (size > 0 && size + n > max) {
      out.push(empty());
      size = 0;
    }
    size += n;
    return out[out.length - 1];
  };
  if (p.bill) room(1).bill = p.bill;
  p.companies.forEach((c) => room(1).companies.push(c));
  p.medicines.forEach((m) => room(1).medicines.push(m));
  for (const b of p.batches) {
    const ev = p.events.filter((e) => e.batchId === b.id);
    const c = room(1 + ev.length);
    c.batches.push(b);
    c.events.push(...ev);
  }
  return out;
}
