import type { AlertDays, Batch, BatchStatus, Medicine, YearMonth } from './types';
import { batchStatus } from './expiry';
import { byExpiry, isLive } from './fefo';

export { isLive };

export function alertCounts(batches: Batch[], today: Date, d: AlertDays) {
  const c = { expired: 0, soon: 0, watch: 0 };
  for (const b of batches.filter(isLive)) {
    const s = batchStatus(b.expiry, today, d);
    if (s !== 'ok') c[s]++;
  }
  return c;
}

export const batchesByStatus = (
  batches: Batch[],
  today: Date,
  d: AlertDays,
  status: Exclude<BatchStatus, 'ok'>,
): Batch[] =>
  batches.filter((b) => isLive(b) && batchStatus(b.expiry, today, d) === status).sort(byExpiry);

export const STATUS_ORDER: BatchStatus[] = ['expired', 'soon', 'watch', 'ok'];

export function medicineSummary(medicineId: string, batches: Batch[], today: Date, d: AlertDays) {
  const live = batches.filter((b) => b.medicineId === medicineId && isLive(b)).sort(byExpiry);
  const next: YearMonth | null = live[0]?.expiry ?? null;
  const worst = next ? batchStatus(next, today, d) : null; // soonest expiry is always the worst status
  return { qty: live.reduce((s, b) => s + b.qty, 0), batchCount: live.length, next, worst };
}

export function categorySummary(
  categoryId: string,
  medicines: Medicine[],
  batches: Batch[],
  today: Date,
  d: AlertDays,
) {
  const ids = new Set(medicines.filter((m) => m.categoryId === categoryId).map((m) => m.id));
  const live = batches.filter((b) => ids.has(b.medicineId) && isLive(b));
  const statuses = live.map((b) => batchStatus(b.expiry, today, d));
  const worst = STATUS_ORDER.find((s) => statuses.includes(s)) ?? null;
  return {
    medicineCount: ids.size,
    unitCount: live.reduce((s, b) => s + b.qty, 0),
    worst,
    worstCount: statuses.filter((s) => s === worst).length,
  };
}
