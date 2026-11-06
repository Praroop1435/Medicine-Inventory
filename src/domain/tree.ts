import { STATUS_ORDER, categorySummary } from './alerts';
import type { AlertDays, Batch, Category, Medicine } from './types';

// Categories form a tree of folders via parentId (§11.1). A missing parentId (older docs) is top level.
const parentOf = (c: Category) => c.parentId ?? null;

/** One sibling group, by order then name. */
export const childrenOf = (cats: Category[], parentId: string | null): Category[] =>
  cats
    .filter((c) => parentOf(c) === parentId)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

/** Every folder below `id`, any depth, excluding `id`. Safe on a corrupt cycle. */
export function descendantIds(cats: Category[], id: string): string[] {
  const out: string[] = [];
  const queue = [id];
  while (queue.length) {
    const p = queue.shift();
    for (const c of cats)
      if (parentOf(c) === p && c.id !== id && !out.includes(c.id)) {
        out.push(c.id);
        queue.push(c.id);
      }
  }
  return out;
}

export const isDescendant = (cats: Category[], id: string, ancestorId: string): boolean =>
  descendantIds(cats, ancestorId).includes(id);

/** Names from the top-level folder down to `id`. */
export function pathOf(cats: Category[], id: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  let c = cats.find((x) => x.id === id);
  while (c && !seen.has(c.id)) {
    seen.add(c.id);
    out.unshift(c.name);
    const p = parentOf(c);
    c = cats.find((x) => x.id === p);
  }
  return out;
}

/** "Syrups › Cough" */
export const pathLabel = (cats: Category[], id: string): string => pathOf(cats, id).join(' › ');

/** All folders depth-first in sibling order, the order a folder picker lists them. */
export function walk(cats: Category[], parentId: string | null = null): Category[] {
  return childrenOf(cats, parentId).flatMap((c) => [c, ...walk(cats, c.id)]);
}

/** Order for a folder appended to a sibling group. */
export const nextOrder = (cats: Category[], parentId: string | null): number =>
  Math.max(-1, ...childrenOf(cats, parentId).map((c) => c.order)) + 1;

/** categorySummary across a folder and everything inside it. */
export function rollupSummary(
  cats: Category[],
  medicines: Medicine[],
  batches: Batch[],
  id: string,
  today: Date,
  d: AlertDays,
) {
  const parts = [id, ...descendantIds(cats, id)].map((c) =>
    categorySummary(c, medicines, batches, today, d),
  );
  const worst = STATUS_ORDER.find((s) => parts.some((p) => p.worst === s)) ?? null;
  return {
    medicineCount: parts.reduce((n, p) => n + p.medicineCount, 0),
    unitCount: parts.reduce((n, p) => n + p.unitCount, 0),
    worst,
    worstCount: parts.reduce((n, p) => n + (p.worst === worst ? p.worstCount : 0), 0),
  };
}
