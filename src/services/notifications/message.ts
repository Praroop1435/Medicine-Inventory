import { childrenOf } from '@/domain/tree';
import type { AlertDays, Category } from '@/domain/types';

type Counts = { expired: number; soon: number; watch: number };

const expire = (n: number, days: number) =>
  `${n} ${n === 1 ? 'expires' : 'expire'} within ${days} days`;

/** Morning text (§6.8): expired plus the nearest window that has stock; null = nothing to send. */
export function dailyMessage(c: Counts, d: AlertDays): string | null {
  const parts: string[] = [];
  if (c.expired) parts.push(`${c.expired} expired`);
  if (c.soon) parts.push(expire(c.soon, d.second));
  else if (c.watch) parts.push(expire(c.watch, d.first));
  return parts.length ? parts.join(' · ') : null;
}

/** The top-level folder checked least recently; never-checked folders come first. */
export const dueCategory = (cats: Category[]): Category | undefined =>
  childrenOf(cats, null).reduce<Category | undefined>(
    (due, c) => (!due || (c.lastCheckedAt ?? -1) < (due.lastCheckedAt ?? -1) ? c : due),
    undefined,
  );

const DAY = 86_400_000;
const START = "Time for tonight's stock update — mark what was sold today.";

/** Night reminder text (§11.5). `today` is local midnight. */
export function nightReminder(cats: Category[], today: Date): string {
  const due = dueCategory(cats);
  if (!due) return START;
  if (due.lastCheckedAt === null) return `${START} Due: ${due.name} (never checked).`;
  const at = new Date(due.lastCheckedAt);
  const days = Math.round(
    (today.getTime() - new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime()) / DAY,
  );
  const ago = days <= 0 ? 'checked today' : `not checked for ${days} day${days === 1 ? '' : 's'}`;
  return `${START} Due: ${due.name} (${ago}).`;
}
