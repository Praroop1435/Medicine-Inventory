import type { Unit } from '@/domain/types';

/** "carton" / "cartons" / "boxes": the unit word for n, without the number. */
export const unitWord = (unit: Unit, n: number): string =>
  n === 1 || unit === 'drops' ? unit : /(s|x|z|ch|sh)$/.test(unit) ? `${unit}es` : `${unit}s`;

/** "1 carton" / "5 cartons" / "2 boxes". */
export const pluralUnit = (unit: Unit, n: number): string => `${n} ${unitWord(unit, n)}`;

export const medicineCount = (n: number): string => `${n} medicine${n === 1 ? '' : 's'}`;

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "4 Nov" from a Date or a "YYYY-MM-DD" string (parsed by hand, so no timezone shift). */
export const dayMonth = (d: Date | string): string => {
  const [m, day] =
    typeof d === 'string'
      ? [Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))]
      : [d.getMonth(), d.getDate()];
  return `${day} ${MON[m]}`;
};

/** "in 24 days", "in 9 months", "today", "3 days ago". */
export function expiresIn(days: number): string {
  if (days < 0) return `${-days} day${days === -1 ? '' : 's'} ago`;
  if (days === 0) return 'today';
  if (days < 60) return `in ${days} day${days === 1 ? '' : 's'}`;
  return `in ${Math.round(days / 30)} months`;
}
