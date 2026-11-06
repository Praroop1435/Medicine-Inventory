import type { Unit } from '@/domain/types';

/** "1 carton" / "5 cartons" / "2 boxes". */
export const pluralUnit = (unit: Unit, n: number): string =>
  `${n} ${unit}${n === 1 ? '' : unit === 'box' ? 'es' : 's'}`;

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
