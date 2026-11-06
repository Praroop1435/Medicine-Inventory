import type { Unit } from '@/domain/types';

/** "1 carton" / "5 cartons" / "2 boxes". */
export const pluralUnit = (unit: Unit, n: number): string =>
  `${n} ${unit}${n === 1 ? '' : unit === 'box' ? 'es' : 's'}`;
