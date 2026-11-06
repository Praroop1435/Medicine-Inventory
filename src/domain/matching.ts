import type { Medicine } from './types';

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

const numbers = (n: string) => (n.match(/\d+/g) ?? []).sort().join(',');

function bigrams(n: string): string[] {
  const t = n.replace(/ /g, '');
  const out: string[] = [];
  for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
  return out;
}

function dice(a: string, b: string): number {
  const x = bigrams(a);
  const y = bigrams(b);
  if (x.length === 0 || y.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const g of y) counts.set(g, (counts.get(g) ?? 0) + 1);
  let hit = 0;
  for (const g of x) {
    const c = counts.get(g) ?? 0;
    if (c > 0) {
      hit++;
      counts.set(g, c - 1);
    }
  }
  return (2 * hit) / (x.length + y.length);
}

export function findMedicineMatch(name: string, medicines: Medicine[]): Medicine | null {
  const q = normalizeName(name);
  if (!q) return null;
  const qn = numbers(q);
  let best: Medicine | null = null;
  let bestScore = 0.8;
  let bestFound = false;
  for (const m of medicines) {
    const n = normalizeName(m.name);
    if (numbers(n) !== qn) continue;
    if (n === q) return m;
    const s = dice(q, n);
    if (s >= bestScore && (!bestFound || s > bestScore)) {
      best = m;
      bestScore = s;
      bestFound = true;
    }
  }
  return best;
}
