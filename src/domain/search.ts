import { isLive } from './fefo';
import { normalizeName } from './matching';
import type { Batch, Company, Medicine } from './types';

export type SearchResult = {
  medicineId: string;
  title: string;
  subtitle: string;
  matchedBatchNo?: string;
};

export function searchInventory(
  query: string,
  medicines: Medicine[],
  companies: Company[],
  batches: Batch[],
): SearchResult[] {
  if (query.replace(/\s/g, '').length < 2) return [];
  const q = normalizeName(query);
  if (!q) return [];
  const live = batches.filter(isLive);
  const hits: { r: SearchResult; prefix: boolean; key: string }[] = [];
  for (const m of medicines) {
    const name = normalizeName(m.name);
    const company = companies.find((c) => c.id === m.companyId)?.name ?? '';
    const mine = live.filter((b) => b.medicineId === m.id);
    const batch = mine.find((b) => normalizeName(b.batchNo).includes(q));
    const byName = name.includes(q);
    if (!byName && !normalizeName(company).includes(q) && !batch) continue;
    const qty = mine.reduce((s, b) => s + b.qty, 0);
    hits.push({
      prefix: name.startsWith(q),
      key: name,
      r: {
        medicineId: m.id,
        title: m.name,
        subtitle: `${company} · ${qty} ${m.unit}${qty === 1 ? '' : 's'}`,
        ...(!byName && batch ? { matchedBatchNo: batch.batchNo } : {}),
      },
    });
  }
  return hits
    .sort((a, b) => Number(b.prefix) - Number(a.prefix) || a.key.localeCompare(b.key))
    .map((h) => h.r);
}
